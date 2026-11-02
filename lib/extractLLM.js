'use strict';

/**
 * Optional LLM-backed invoice extraction.
 *
 * This is a best-effort enhancement over the deterministic extractor in
 * `lib/extract.js`. It is only active when OPENCODE_GO_API_KEY is set, and it
 * never throws: any network, HTTP, parsing, or validation problem returns
 * `null` so the caller can fall back to the local extractor.
 */

const { randomUUID } = require('node:crypto');

const API_URL = 'https://opencode.ai/zen/go/v1/chat/completions';
const MODEL = 'deepseek-v4.1-flash';
const TIMEOUT_MS = 15_000;
// OpenCode Go rejects requests without a session header (400 MissingSessionID),
// so every process identifies itself with one stable session id.
const SESSION_ID = randomUUID();

const SYSTEM_PROMPT = `You are an invoice extraction engine. Read the client message and respond with ONLY one JSON object, with no markdown, code fences, or commentary.

The object must contain exactly these fields:
- clientName: string (empty string if unknown)
- clientEmail: string (empty string if unknown)
- item: string (a short description of the work being paid for)
- amount: number (a positive number, with no currency symbols or commas)
- currency: string (a three-letter ISO 4217 currency code such as USD)
- dueDate: string in YYYY-MM-DD format, or null if no due date is present

Return JSON only.`;

function stripFences(value) {
  let text = String(value || '').trim();
  if (!text) {
    return '';
  }
  text = text.replace(/^\uFEFF/, '').trim();

  // Remove a leading ```json / ``` and a trailing ``` if the model wrapped its
  // answer in a markdown code fence.
  text = text.replace(/^```[a-zA-Z0-9_-]*\s*/, '').replace(/\s*```$/, '').trim();
  return text;
}

function parseModelJson(raw) {
  const text = stripFences(raw);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    // Some models add a sentence before/after the object. Try the widest
    // brace-delimited slice as a last resort.
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function readMessageContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    // OpenAI-compatible endpoints may return content parts instead of a string.
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('');
  }
  return '';
}

function normalizeResult(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const { clientName, clientEmail, item, amount, currency, dueDate } = parsed;

  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  if (typeof currency !== 'string' || !/^[A-Za-z]{3}$/.test(currency.trim())) {
    return null;
  }

  let normalizedDueDate = null;
  if (dueDate !== null && dueDate !== undefined && dueDate !== '') {
    if (typeof dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      return null;
    }
    normalizedDueDate = dueDate.trim();
  }

  return {
    clientName: typeof clientName === 'string' ? clientName.trim() : '',
    clientEmail: typeof clientEmail === 'string' ? clientEmail.trim() : '',
    item: typeof item === 'string' ? item.trim() : '',
    amount,
    currency: currency.trim().toUpperCase(),
    dueDate: normalizedDueDate,
    confidence: 0.9,
    engine: 'llm',
  };
}

/**
 * Extract an invoice with the OpenCode Go chat-completions endpoint.
 *
 * @param {string} text raw client message
 * @returns {Promise<{
 *   clientName: string,
 *   clientEmail: string,
 *   item: string,
 *   amount: number,
 *   currency: string,
 *   dueDate: string|null,
 *   confidence: number,
 *   engine: 'llm'
 * } | null>} `null` when unavailable or when anything fails
 */
async function extractInvoiceLLM(text) {
  const apiKey = process.env.OPENCODE_GO_API_KEY;
  if (!apiKey || typeof text !== 'string' || !text.trim()) {
    return null;
  }
  if (typeof fetch !== 'function') {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'x-opencode-session': SESSION_ID,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      }),
      signal: controller.signal,
    });

    if (!response || !response.ok) {
      return null;
    }

    const payload = await response.json();
    return normalizeResult(parseModelJson(readMessageContent(payload)));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { extractInvoiceLLM };
