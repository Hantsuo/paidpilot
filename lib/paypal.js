'use strict';

/**
 * Minimal PayPal Sandbox client.
 *
 * The only accepted credentials are PAYPAL_CLIENT_ID and
 * PAYPAL_CLIENT_SECRET. When either is absent the client returns a clearly
 * labelled mock order with the same shape as a real Orders v2 response, so the
 * entire PaidPilot demo works offline.
 */

const PAYPAL_BASE = 'https://api-m.sandbox.paypal.com';
const TOKEN_URL = `${PAYPAL_BASE}/v1/oauth2/token`;
const ORDERS_URL = `${PAYPAL_BASE}/v2/checkout/orders`;
const REQUEST_TIMEOUT_MS = 15_000;

function isPayPalLive() {
  return Boolean(
    String(process.env.PAYPAL_CLIENT_ID || '').trim() &&
      String(process.env.PAYPAL_CLIENT_SECRET || '').trim()
  );
}

function normalizeAmount(amount) {
  const numeric =
    typeof amount === 'number'
      ? amount
      : Number(String(amount ?? '').replace(/[^0-9.-]/g, ''));

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error('A positive payment amount is required.');
  }
  if (numeric > 1_000_000_000) {
    throw new Error('Payment amount is too large.');
  }
  return numeric.toFixed(2);
}

function normalizeCurrency(currency) {
  const code = String(currency || 'USD').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(code)) {
    throw new Error('Currency must be a three-letter ISO code (for example USD).');
  }
  return code;
}

function normalizeItem(item) {
  const description = String(item || 'Freelance services').replace(/\s+/g, ' ').trim();
  return (description || 'Freelance services').slice(0, 127);
}

function pickPaymentLink(order) {
  const links = Array.isArray(order?.links) ? order.links : [];
  const preferred =
    links.find((link) => link && link.rel === 'payer-action') ||
    links.find((link) => link && link.rel === 'approve') ||
    links.find((link) => link && link.href);
  return preferred?.href || '';
}

function mockOrder({ amount, currency, item }) {
  const value = normalizeAmount(amount);
  const currencyCode = normalizeCurrency(currency);
  const description = normalizeItem(item);
  const id = `MOCK-${Date.now().toString(36).toUpperCase()}-${Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase()}`;

  return {
    id,
    status: 'CREATED',
    mock: true,
    links: [
      { href: '#mock', rel: 'payer-action', method: 'GET' },
      { href: '#mock', rel: 'approve', method: 'GET' },
    ],
    paymentLink: '#mock',
    purchase_units: [
      {
        amount: {
          currency_code: currencyCode,
          value,
        },
        description,
      },
    ],
    create_time: new Date().toISOString(),
    message:
      'MOCK PayPal order — PAYPAL_CLIENT_ID and/or PAYPAL_CLIENT_SECRET are not set. No network request was made.',
  };
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('PayPal request timed out. Please try again.');
    }
    throw new Error(`Could not reach PayPal: ${error?.message || 'network error'}`);
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function getAccessToken() {
  const clientId = String(process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.PAYPAL_CLIENT_SECRET || '').trim();

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are not configured.');
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetchWithTimeout(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  const data = await readJson(response);
  if (!response.ok || !data?.access_token) {
    throw new Error(
      `PayPal authentication failed (HTTP ${response.status}). Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.`
    );
  }
  return data.access_token;
}

/**
 * Create a PayPal Sandbox order, or a mock order when credentials are absent.
 *
 * @param {{amount: number|string, currency?: string, item?: string}} input
 * @returns {Promise<object>} PayPal Orders v2-shaped object
 */
async function createOrder({ amount, currency = 'USD', item = 'Freelance services' } = {}) {
  const value = normalizeAmount(amount);
  const currencyCode = normalizeCurrency(currency);
  const description = normalizeItem(item);

  if (!isPayPalLive()) {
    return mockOrder({ amount: value, currency: currencyCode, item: description });
  }

  const accessToken = await getAccessToken();
  const response = await fetchWithTimeout(ORDERS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          description,
          amount: {
            currency_code: currencyCode,
            value,
          },
        },
      ],
    }),
    cache: 'no-store',
  });

  const data = await readJson(response);
  if (!response.ok || !data?.id) {
    const detail =
      data?.details?.[0]?.description ||
      data?.details?.[0]?.issue ||
      data?.message ||
      'Unknown PayPal error';
    throw new Error(`PayPal order creation failed (HTTP ${response.status}): ${detail}`);
  }

  return {
    ...data,
    mock: false,
    paymentLink: pickPaymentLink(data),
  };
}

module.exports = {
  createOrder,
  isPayPalLive,
  pickPaymentLink,
};
