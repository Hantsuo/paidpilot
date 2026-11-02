'use strict';

/**
 * Template-based reminder writer.
 *
 * Deliberately local and deterministic: no API key, no network call. The tone
 * is friendly and non-accusatory, and the draft always references the amount,
 * due date, and PayPal link when those details are available.
 */

function formatMoney(amount, currency = 'USD') {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return '';
  }
  const code = String(currency || 'USD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${code} ${value.toFixed(2)}`;
  }
}

function formatDueDate(dueDate) {
  if (!dueDate) {
    return '';
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dueDate));
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date);
    }
  }
  return String(dueDate);
}

function firstName(clientName) {
  const first = String(clientName || '')
    .trim()
    .split(/\s+/)[0];
  return first || 'there';
}

function itemLabel(item) {
  const clean = String(item || '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .trim();
  return clean ? `the ${clean} invoice` : 'the outstanding invoice';
}

function paymentLinkFor(invoice) {
  return (
    invoice.paymentLink ||
    invoice.paypalLink ||
    invoice.paypalOrderLink ||
    invoice.paypalLinkUrl ||
    ''
  );
}

/**
 * Draft a polite follow-up for an overdue invoice.
 *
 * @param {{
 *   clientName?: string,
 *   item?: string,
 *   amount?: number|string,
 *   currency?: string,
 *   dueDate?: string,
 *   paymentLink?: string,
 *   paypalLink?: string
 * }} invoice
 * @returns {string} ready-to-send email draft
 */
function draftReminder(invoice = {}) {
  const amountText = formatMoney(invoice.amount, invoice.currency || 'USD');
  const dueText = formatDueDate(invoice.dueDate);
  const link = paymentLinkFor(invoice);
  const label = itemLabel(invoice.item);

  const amountPhrase = amountText ? ` for ${amountText}` : '';
  const duePhrase = dueText ? `, which was due on ${dueText}` : '';

  const lines = [
    `Subject: A friendly follow-up on ${label}`,
    '',
    `Hi ${firstName(invoice.clientName)},`,
    '',
    `I hope you're doing well. I wanted to gently follow up on ${label}${amountPhrase}${duePhrase}.`,
    '',
    'I know things get busy, so no pressure at all — I just wanted to make sure it did not slip through the cracks.',
    '',
  ];

  if (link) {
    lines.push('You can complete the payment securely here:', link, '');
  } else {
    lines.push('I am happy to resend the PayPal payment link if that would make things easier.', '');
  }

  lines.push(
    'If it has already been taken care of, please disregard this note — and thank you!',
    '',
    'Best regards,',
    invoice.senderName || 'PaidPilot'
  );

  return lines.join('\n');
}

module.exports = { draftReminder, formatMoney, formatDueDate };
