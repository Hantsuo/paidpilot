'use strict';

/**
 * PaidPilot's deterministic, local invoice extractor.
 *
 * No API key, network call, or model is required. The heuristics intentionally
 * favour precision over recall so a demo never invents a wild invoice amount.
 */

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const MONTH_PATTERN =
  'Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?';

const CURRENCY_CODES = [
  'USD',
  'EUR',
  'GBP',
  'CAD',
  'AUD',
  'JPY',
  'INR',
  'NZD',
  'CHF',
  'SEK',
  'NOK',
  'DKK',
  'SGD',
  'HKD',
];

const SYMBOL_CURRENCIES = [
  ['US$', 'USD'],
  ['C$', 'CAD'],
  ['A$', 'AUD'],
  ['NZ$', 'NZD'],
  ['$', 'USD'],
  ['€', 'EUR'],
  ['£', 'GBP'],
  ['¥', 'JPY'],
  ['₹', 'INR'],
];

const MONEY_LIKE =
  /(?:[$€£¥₹]|\b(?:USD|EUR|GBP|CAD|AUD|JPY|INR|NZD|CHF|SEK|NOK|DKK|SGD|HKD)\b|\d[\d,]*\.\d{1,2}|\b\d{3,}\b)/i;

const ITEM_KEYWORDS =
  /\b(?:design|redesign|website|site|web|app|application|api|integration|development|dev|code|coding|copy|copywriting|logo|brand|branding|audit|consult|consulting|retainer|dashboard|landing|page|seo|marketing|video|content|bug|fix|feature|prototype|ui|ux|database|migration|setup|maintenance|support|automation|analysis|research|illustration|photography|strategy|deck|presentation)\b/i;

const NAME_BLOCKLIST = new Set([
  'hi',
  'hello',
  'hey',
  'dear',
  'thanks',
  'thank',
  'best',
  'regards',
  'cheers',
  'sincerely',
  'the',
  'our',
  'your',
  'this',
  'that',
  'invoice',
  'payment',
  'paypal',
  'please',
  'could',
  'would',
  'can',
  'we',
  'you',
  'i',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
]);

function cleanSpace(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function parseMoneyNumber(raw) {
  const value = Number(String(raw).replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0 || value >= 1_000_000_000) {
    return null;
  }
  return Math.round(value * 100) / 100;
}

function findAmount(text) {
  /** @type {{value:number,index:number,currency:string|null,weight:number}[]} */
  const candidates = [];

  const add = (raw, index, currency, weight) => {
    const value = parseMoneyNumber(raw);
    if (value !== null) {
      candidates.push({ value, index, currency: currency || null, weight });
    }
  };

  // $1,200 / €900 / US$75
  const symbolRe = /(US\$|C\$|A\$|NZ\$|[$€£¥₹])\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/g;
  let match;
  while ((match = symbolRe.exec(text)) !== null) {
    const currency = (SYMBOL_CURRENCIES.find(([symbol]) => symbol === match[1]) || [])[1] || null;
    add(match[2], match.index, currency, 2.5);
  }

  // 1200 USD / USD 1200
  const codeAfterRe = new RegExp(
    `\\b([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\s*(${CURRENCY_CODES.join('|')})\\b`,
    'gi'
  );
  while ((match = codeAfterRe.exec(text)) !== null) {
    add(match[1], match.index, match[2].toUpperCase(), 3);
  }

  const codeBeforeRe = new RegExp(
    `\\b(${CURRENCY_CODES.join('|')})\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)\\b`,
    'gi'
  );
  while ((match = codeBeforeRe.exec(text)) !== null) {
    add(match[2], match.index, match[1].toUpperCase(), 3);
  }

  // "amount of 1200", "total: $1,200", "invoice for 1200"
  const keywordRe =
    /\b(?:amount|total|invoice|fee|price|budget|quote|cost|charge|deposit)\b[^0-9\n]{0,32}([0-9][0-9,]*(?:\.[0-9]{1,2})?)/gi;
  while ((match = keywordRe.exec(text)) !== null) {
    add(match[1], match.index, null, 1.4);
  }

  // "1200 dollars" / "900 euros"
  const wordRe = /\b([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(dollars?|bucks|euros?|pounds?)\b/gi;
  while ((match = wordRe.exec(text)) !== null) {
    const word = match[2].toLowerCase();
    const currency = word.startsWith('euro') ? 'EUR' : word.startsWith('pound') ? 'GBP' : 'USD';
    add(match[1], match.index, currency, 2);
  }

  if (!candidates.length) {
    return { amount: null, currency: 'USD', currencyExplicit: false };
  }

  candidates.sort((a, b) => b.weight - a.weight || a.index - b.index);
  const best = candidates[0];

  let currency = best.currency;
  if (!currency) {
    const codeMatch = text.match(new RegExp(`\\b(${CURRENCY_CODES.join('|')})\\b`, 'i'));
    if (codeMatch) {
      currency = codeMatch[1].toUpperCase();
    } else {
      const symbol = SYMBOL_CURRENCIES.find(([candidate]) => text.includes(candidate));
      currency = symbol ? symbol[1] : 'USD';
    }
  }

  return {
    amount: best.value,
    currency,
    currencyExplicit: Boolean(best.currency) || /[$€£¥₹]/.test(text),
  };
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function makeIsoDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) {
    return null;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function inferYear(month, day, explicitYear) {
  if (explicitYear) {
    return Number(explicitYear);
  }
  const now = new Date();
  let year = now.getUTCFullYear();
  const candidate = new Date(Date.UTC(year, month - 1, day));
  // If a bare "Nov 20" is already well in the past, the sender almost
  // certainly means next year.
  if (candidate.getTime() < now.getTime() - 45 * 24 * 60 * 60 * 1000) {
    year += 1;
  }
  return year;
}

function dateContextScore(text, index) {
  const before = text.slice(Math.max(0, index - 36), index).toLowerCase();
  if (/\b(?:by|due|before|deadline|no later than|on or before)\s*$/.test(before)) {
    return 3;
  }
  if (/\b(?:due|deadline)\b/.test(before)) {
    return 2;
  }
  return 0;
}

function findDueDate(text) {
  /** @type {{date:string,index:number,score:number}[]} */
  const candidates = [];
  let match;

  const add = (date, index) => {
    if (date) {
      candidates.push({ date, index, score: dateContextScore(text, index) });
    }
  };

  // 2026-11-20
  const isoRe = /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g;
  while ((match = isoRe.exec(text)) !== null) {
    add(makeIsoDate(Number(match[1]), Number(match[2]), Number(match[3])), match.index);
  }

  // Nov 20, 2026 / November 20 / Nov 20th
  const monthRe = new RegExp(
    `\\b(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(20\\d{2}))?\\b`,
    'gi'
  );
  while ((match = monthRe.exec(text)) !== null) {
    const month = MONTHS[match[1].toLowerCase().slice(0, 3)];
    const day = Number(match[2]);
    const year = inferYear(month, day, match[3]);
    add(makeIsoDate(year, month, day), match.index);
  }

  // 20 November 2026 / 20th Nov
  const dayMonthRe = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})\\.?(?:,?\\s+(20\\d{2}))?\\b`,
    'gi'
  );
  while ((match = dayMonthRe.exec(text)) !== null) {
    const month = MONTHS[match[2].toLowerCase().slice(0, 3)];
    const day = Number(match[1]);
    const year = inferYear(month, day, match[3]);
    add(makeIsoDate(year, month, day), match.index);
  }

  // 11/20/2026 (US-style) and 2026/11/20
  const slashRe = /\b(\d{4})\/(\d{1,2})\/(\d{1,2})\b|\b(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})\b/g;
  while ((match = slashRe.exec(text)) !== null) {
    if (match[1]) {
      add(makeIsoDate(Number(match[1]), Number(match[2]), Number(match[3])), match.index);
    } else {
      const year = Number(match[6].length === 2 ? `20${match[6]}` : match[6]);
      add(makeIsoDate(year, Number(match[4]), Number(match[5])), match.index);
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0].date;
}

function findEmail(text) {
  const match = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
  return match ? match[0] : '';
}

function titleCase(value) {
  return String(value)
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function isPlausibleName(name) {
  const tokens = String(name || '').trim().split(/\s+/);
  if (!tokens.length || tokens.length > 3) {
    return false;
  }
  if (NAME_BLOCKLIST.has(tokens[0].toLowerCase())) {
    return false;
  }
  if (/\d|@/.test(name)) {
    return false;
  }
  return tokens.every((token) => /^[A-Z][A-Za-z'’-]*$/.test(token));
}

function findClientName(text, email) {
  /** @type {{name:string,score:number,index:number}[]} */
  const candidates = [];

  const add = (name, score, index) => {
    const cleaned = String(name || '').replace(/[.,;:!?]+$/, '').trim();
    if (isPlausibleName(cleaned)) {
      candidates.push({ name: cleaned, score, index });
    }
  };

  let match;

  // "My name is Maya Chen", "This is Sam Rivera", "I'm Alex Kim"
  const introRe =
    /\b(?:[Mm]y name(?:'s| is)|[Tt]his is|[Ii] am|[Ii]'m)\s+([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,2})/g;
  while ((match = introRe.exec(text)) !== null) {
    add(match[1], 4, match.index);
  }

  // "Thanks,\nMaya Chen" / "Best regards, Sam Rivera"
  const signoffRe =
    /\b(?:[Tt]hanks|[Tt]hank you|[Bb]est regards|[Bb]est|[Rr]egards|[Cc]heers|[Ss]incerely|[Ww]arm regards|[Aa]ll the best)[!,.]?\s*\n?\s*([A-Z][A-Za-z'’-]+(?:\s+[A-Z][A-Za-z'’-]+){0,2})\b/g;
  while ((match = signoffRe.exec(text)) !== null) {
    add(match[1], 3, match.index);
  }

  // A signature line: "Maya Chen\nFounder, Northstar Labs"
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^(?:thanks|thank you|best|regards|cheers|sincerely)[,!. ]*$/i.test(line)) {
      const next = lines[index + 1];
      if (next) {
        add(next.replace(/,.*$/, ''), 2.5, text.indexOf(next));
      }
    }
  }

  if (email) {
    const local = email.split('@')[0];
    const parts = local.split(/[._-]+/).filter((part) => /^[a-z]{2,}$/i.test(part));
    if (parts.length >= 2) {
      add(titleCase(parts.slice(0, 2).join(' ')), 1, text.indexOf(email));
    }
  }

  if (!candidates.length) {
    return '';
  }

  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0].name;
}

function tidyItem(value) {
  return String(value || '')
    .replace(/\s+(?:we|that we|as)\s+(?:discussed|agreed|talked about)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,;:\-–—\s]+|[,;:\-–—\s]+$/g, '')
    .trim();
}

function scoreItemPhrase(phrase) {
  const value = tidyItem(phrase);
  if (value.length < 3 || value.length > 80) {
    return -1;
  }
  if (!/[a-z]/i.test(value) || MONEY_LIKE.test(value) || /@/.test(value)) {
    return -1;
  }
  const words = value.split(/\s+/);
  if (words.length > 9) {
    return -1;
  }
  let score = 0;
  if (ITEM_KEYWORDS.test(value)) {
    score += 2;
  }
  if (words.length <= 5) {
    score += 1;
  }
  if (/\b(?:invoice|payment|paypal|due|date|email|thank|please|could|would|can|send|make)\b/i.test(value)) {
    score -= 3;
  }
  return score;
}

function findItem(text) {
  /** @type {{item:string,score:number,index:number}[]} */
  const candidates = [];
  let match;

  const add = (phrase, index) => {
    const item = tidyItem(phrase);
    const score = scoreItemPhrase(item);
    if (score >= 0) {
      candidates.push({ item, score, index });
    }
  };

  // "for the dashboard redesign", "covering the API integration"
  const forRe =
    /\b(?:for|covering|regarding|re:)\s+(?:the\s+|a\s+|an\s+|our\s+|your\s+)?([^.,;!?\n]{2,80}?)(?=\s+(?:for|by|before|due|at)\b|[.,;!?\n]|$)/gi;
  while ((match = forRe.exec(text)) !== null) {
    add(match[1], match.index);
  }

  // "the project is a marketing site", "job: logo refresh"
  const projectRe =
    /\b(?:project|job|work|scope)\s*(?:is|:|-|–|—)?\s*([^.,;!?\n]{3,80}?)(?=\s+(?:by|before|due|at)\b|[.,;!?\n]|$)/gi;
  while ((match = projectRe.exec(text)) !== null) {
    add(match[1], match.index);
  }

  if (!candidates.length) {
    return '';
  }

  // Prefer meaningful item language, then the earliest clean mention.
  candidates.sort((a, b) => b.score - a.score || a.index - b.index);
  const item = candidates[0].item;
  return item.charAt(0).toUpperCase() + item.slice(1);
}

/**
 * Extract a draft invoice from a raw client message.
 *
 * @param {string} text
 * @returns {{
 *   clientName: string,
 *   clientEmail: string,
 *   item: string,
 *   amount: number|null,
 *   currency: string,
 *   dueDate: string|null,
 *   confidence: number,
 *   engine: 'local'
 * }}
 */
function extractInvoice(text) {
  const source = cleanSpace(text);
  const safeText = source || '';

  const { amount, currency, currencyExplicit } = findAmount(safeText);
  const clientEmail = findEmail(safeText);
  const clientName = findClientName(safeText, clientEmail);
  const item = findItem(safeText);
  const dueDate = findDueDate(safeText);

  let confidence = 0.2;
  if (amount !== null) confidence += 0.3;
  if (dueDate) confidence += 0.2;
  if (clientEmail) confidence += 0.15;
  if (clientName) confidence += 0.1;
  if (item) confidence += 0.05;
  if (currencyExplicit) confidence += 0.05;

  return {
    clientName,
    clientEmail,
    item,
    amount,
    currency,
    dueDate,
    confidence: Math.min(0.99, Math.round(confidence * 100) / 100),
    engine: 'local',
  };
}

module.exports = { extractInvoice };
