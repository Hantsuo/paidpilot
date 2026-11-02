'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import reminder from '@/lib/reminder';

const { draftReminder } = reminder;

const InvoiceGrid = dynamic(() => import('./InvoiceGrid'), {
  ssr: false,
  loading: () => <div className="grid-loading">Loading invoice grid…</div>,
});

const SAMPLE_MESSAGE = `Hi! This is Maya Chen from Northstar Labs. Could you send an invoice for $1,200 USD for the dashboard redesign? Payment is due by Nov 20, 2026. You can reach me at maya@northstarlabs.io.

Thanks,
Maya Chen`;

const EMPTY_FORM = {
  clientName: '',
  clientEmail: '',
  item: '',
  amount: '',
  currency: 'USD',
  dueDate: '',
};

const SEED_ROWS = [
  {
    id: 'seed-1',
    clientName: 'Maya Chen',
    clientEmail: 'maya@northstarlabs.io',
    item: 'Dashboard redesign',
    amount: 1200,
    currency: 'USD',
    status: 'sent',
    dueDate: '2026-11-20',
    paypalOrderId: 'SAMPLE-7QK21',
    paypalLink: '#mock',
    paypalMock: true,
  },
  {
    id: 'seed-2',
    clientName: 'Jordan Ellis',
    clientEmail: 'jordan@ellisstudio.co',
    item: 'Landing page copy',
    amount: 450,
    currency: 'USD',
    status: 'overdue',
    dueDate: '2026-10-15',
    paypalOrderId: 'SAMPLE-3MZ88',
    paypalLink: '#mock',
    paypalMock: true,
  },
  {
    id: 'seed-3',
    clientName: 'Priya Nair',
    clientEmail: 'priya@nairlabs.dev',
    item: 'API integration',
    amount: 2400,
    currency: 'USD',
    status: 'paid',
    dueDate: '2026-09-30',
    paypalOrderId: 'SAMPLE-9PL04',
    paypalLink: '#mock',
    paypalMock: true,
  },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

function newRowId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function paymentLinkFrom(order) {
  if (order?.paymentLink) {
    return order.paymentLink;
  }
  const links = Array.isArray(order?.links) ? order.links : [];
  const preferred =
    links.find((link) => link?.rel === 'payer-action') ||
    links.find((link) => link?.rel === 'approve') ||
    links[0];
  return preferred?.href || '#mock';
}

function wordCount(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export default function HomePage() {
  const [message, setMessage] = useState(SAMPLE_MESSAGE);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confidence, setConfidence] = useState(null);
  const [rows, setRows] = useState(SEED_ROWS);
  const [paypalMode, setPaypalMode] = useState({ loading: true, live: false });
  const [extracting, setExtracting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState(null);
  const [lastOrder, setLastOrder] = useState(null);
  const [reminderDraft, setReminderDraft] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/paypal/mode', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Mode check failed');
        }
        return response.json();
      })
      .then((data) => {
        if (!cancelled) {
          setPaypalMode({ loading: false, live: Boolean(data.live) });
        }
      })
      .catch(() => {
        if (!cancelled) {
          // If the mode endpoint cannot be reached, mock mode is the safe default.
          setPaypalMode({ loading: false, live: false, unreachable: true });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!reminderDraft) {
      return undefined;
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setReminderDraft(null);
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [reminderDraft]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      awaiting: rows.filter((row) => row.status === 'sent' || row.status === 'draft').length,
      overdue: rows.filter((row) => row.status === 'overdue').length,
      paid: rows.filter((row) => row.status === 'paid').length,
    }),
    [rows]
  );

  const modeLabel = paypalMode.loading
    ? 'PayPal Sandbox (checking mode…)'
    : paypalMode.live
      ? 'PayPal Sandbox (live)'
      : 'PayPal Sandbox (mock — no credentials set)';

  const confidencePct = confidence === null ? null : Math.round(confidence * 100);

  function updateForm(field, value) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleExtract() {
    if (!message.trim()) {
      setNotice({ kind: 'error', text: 'Paste a client message first.' });
      return;
    }

    setExtracting(true);
    setNotice(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: message }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Could not extract the invoice.');
      }

      setForm({
        clientName: data.clientName || '',
        clientEmail: data.clientEmail || '',
        item: data.item || '',
        amount: data.amount === null || data.amount === undefined ? '' : String(data.amount),
        currency: data.currency || 'USD',
        dueDate: data.dueDate || '',
      });
      setConfidence(typeof data.confidence === 'number' ? data.confidence : null);
      setNotice({
        kind: 'success',
        text: `Invoice details extracted${
          typeof data.confidence === 'number'
            ? ` with ${Math.round(data.confidence * 100)}% confidence`
            : ''
        }. Review the fields, then create the PayPal order.`,
      });
    } catch (error) {
      setNotice({ kind: 'error', text: error?.message || 'Extraction failed.' });
    } finally {
      setExtracting(false);
    }
  }

  async function handleCreate() {
    const amount = Number(form.amount);

    if (!form.item.trim()) {
      setNotice({ kind: 'error', text: 'Add a short item description before creating the order.' });
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setNotice({ kind: 'error', text: 'Enter a valid amount greater than zero.' });
      return;
    }

    setCreating(true);
    setNotice(null);

    try {
      const response = await fetch('/api/paypal/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: form.currency || 'USD',
          item: form.item.trim(),
        }),
      });
      const order = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(order.error || 'Could not create the PayPal order.');
      }

      const isMock = order.mock === true || String(order.id || '').startsWith('MOCK');
      const link = paymentLinkFrom(order);
      const row = {
        id: newRowId(),
        clientName: form.clientName.trim() || 'New client',
        clientEmail: form.clientEmail.trim(),
        item: form.item.trim(),
        amount,
        currency: form.currency || 'USD',
        status: 'sent',
        dueDate: form.dueDate || '',
        paypalOrderId: order.id || 'UNKNOWN',
        paypalLink: link,
        paypalMock: isMock,
      };

      setRows((previous) => [row, ...previous]);
      setPaypalMode({ loading: false, live: !isMock });
      setLastOrder(order);
      setNotice({
        kind: 'success',
        text: isMock
          ? `Mock PayPal order ${order.id} created. No credentials were needed and no network request was made.`
          : `PayPal Sandbox order ${order.id} created.`,
      });
    } catch (error) {
      setNotice({ kind: 'error', text: error?.message || 'Order creation failed.' });
    } finally {
      setCreating(false);
    }
  }

  const handleStatusChange = useCallback((id, status) => {
    setRows((previous) =>
      previous.map((row) => (row.id === id ? { ...row, status } : row))
    );
  }, []);

  const handleDraftReminder = useCallback((row) => {
    const text = draftReminder({
      clientName: row.clientName,
      item: row.item,
      amount: row.amount,
      currency: row.currency,
      dueDate: row.dueDate,
      paymentLink: row.paypalLink,
    });
    setReminderDraft({
      text,
      clientName: row.clientName || 'your client',
      item: row.item,
    });
  }, []);

  async function handleCopyReminder() {
    if (!reminderDraft) {
      return;
    }
    try {
      await navigator.clipboard.writeText(reminderDraft.text);
      setNotice({ kind: 'success', text: 'Reminder draft copied to your clipboard.' });
    } catch {
      setNotice({
        kind: 'error',
        text: 'Clipboard access was blocked. Select the draft text and copy it manually.',
      });
    }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            P
          </span>
          <span className="brand-copy">
            <span className="brand-name">PaidPilot</span>
            <span className="brand-tagline">AI payment agent for solo devs</span>
          </span>
        </div>

        <div
          className={`mode-pill ${paypalMode.live ? 'is-live' : 'is-mock'} ${
            paypalMode.loading ? 'is-loading' : ''
          }`}
          title="PayPal mode is determined by the presence of PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET."
        >
          <span className="mode-dot" aria-hidden="true" />
          <span>{modeLabel}</span>
        </div>
      </header>

      <main id="top" className="page">
        <section className="hero">
          <div className="hero-copy-block">
            <p className="eyebrow">PayPal AI Hackathon · 2026</p>
            <h1>
              Invoice in minutes.
              <br />
              <span className="hero-accent">Follow up without the cringe.</span>
            </h1>
            <p className="hero-lede">
              Paste a client message. PaidPilot pulls out the details, creates a PayPal
              Sandbox order, and writes the polite nudge you keep putting off.
            </p>
            <div className="hero-chips">
              <span>No API key</span>
              <span>Local extraction</span>
              <span>Mock mode by default</span>
            </div>
          </div>

          <div className="hero-stats" aria-label="Invoice summary">
            <div className="stat">
              <strong>{counts.total}</strong>
              <span>tracked</span>
            </div>
            <div className="stat">
              <strong>{counts.awaiting}</strong>
              <span>awaiting</span>
            </div>
            <div className="stat stat-alert">
              <strong>{counts.overdue}</strong>
              <span>overdue</span>
            </div>
            <div className="stat">
              <strong>{counts.paid}</strong>
              <span>paid</span>
            </div>
          </div>
        </section>

        {notice ? (
          <div className={`notice ${notice.kind}`} role="status">
            <span>{notice.text}</span>
            <button
              type="button"
              className="notice-dismiss"
              aria-label="Dismiss message"
              onClick={() => setNotice(null)}
            >
              ×
            </button>
          </div>
        ) : null}

        <section className="workspace">
          <article className="card composer">
            <div className="card-heading">
              <span className="step">1</span>
              <div>
                <h2>Paste the client message</h2>
                <p>An email, a Slack DM, or a very polite carrier pigeon transcript.</p>
              </div>
            </div>

            <textarea
              className="message-input"
              aria-label="Client message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              spellCheck="false"
            />

            <div className="composer-footer">
              <span className="word-count">{wordCount(message)} words</span>
              <button
                type="button"
                className="btn primary"
                onClick={handleExtract}
                disabled={extracting}
              >
                {extracting ? 'Extracting…' : 'Extract with AI'}
              </button>
            </div>
          </article>

          <article className="card invoice-card">
            <div className="card-heading">
              <span className="step">2</span>
              <div>
                <h2>Review the invoice</h2>
                <p>Every field is editable before any money moves.</p>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Client name</span>
                <input
                  type="text"
                  value={form.clientName}
                  onChange={(event) => updateForm('clientName', event.target.value)}
                  placeholder="Maya Chen"
                />
              </label>

              <label className="field">
                <span>Client email</span>
                <input
                  type="email"
                  value={form.clientEmail}
                  onChange={(event) => updateForm('clientEmail', event.target.value)}
                  placeholder="maya@northstarlabs.io"
                />
              </label>

              <label className="field field-wide">
                <span>Item</span>
                <input
                  type="text"
                  value={form.item}
                  onChange={(event) => updateForm('item', event.target.value)}
                  placeholder="Dashboard redesign"
                />
              </label>

              <label className="field">
                <span>Amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) => updateForm('amount', event.target.value)}
                  placeholder="1200.00"
                />
              </label>

              <label className="field">
                <span>Currency</span>
                <select
                  value={form.currency}
                  onChange={(event) => updateForm('currency', event.target.value)}
                >
                  {CURRENCIES.map((currency) => (
                    <option key={currency} value={currency}>
                      {currency}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field field-wide">
                <span>Due date</span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => updateForm('dueDate', event.target.value)}
                />
              </label>
            </div>

            {confidencePct !== null ? (
              <div className="confidence">
                <div className="confidence-top">
                  <span>Extraction confidence</span>
                  <strong>{confidencePct}%</strong>
                </div>
                <div className="confidence-track" aria-hidden="true">
                  <span
                    className="confidence-fill"
                    style={{ width: `${Math.max(4, confidencePct)}%` }}
                  />
                </div>
              </div>
            ) : null}

            <button
              type="button"
              className="btn primary full-width"
              onClick={handleCreate}
              disabled={creating || !form.item.trim() || !form.amount}
            >
              {creating ? 'Creating order…' : 'Create PayPal payment link'}
            </button>

            <p className="fine-print">
              Orders are created in PayPal Sandbox. With no credentials configured, PaidPilot
              returns a clearly labelled mock order and never contacts PayPal.
            </p>

            {lastOrder ? (
              <div className={`order-receipt ${lastOrder.mock ? 'is-mock' : 'is-live'}`}>
                <div className="receipt-id">
                  <span>{lastOrder.mock ? 'Mock order created' : 'Sandbox order created'}</span>
                  <code>{lastOrder.id}</code>
                </div>
                {lastOrder.paymentLink && lastOrder.paymentLink !== '#mock' ? (
                  <a href={lastOrder.paymentLink} target="_blank" rel="noreferrer">
                    Open checkout
                  </a>
                ) : (
                  <span className="receipt-mock-link">Mock link: {lastOrder.paymentLink || '#mock'}</span>
                )}
              </div>
            ) : null}
          </article>
        </section>

        <section className="card dashboard" aria-labelledby="pipeline-title">
          <div className="dashboard-head">
            <div className="card-heading flush">
              <span className="step">3</span>
              <div>
                <h2 id="pipeline-title">Invoice pipeline</h2>
                <p>Click a status cell to change it. Overdue rows can draft a polite reminder.</p>
              </div>
            </div>
            <div className="pipeline-summary" aria-label="Pipeline summary">
              <span>
                <strong>{counts.overdue}</strong> overdue
              </span>
              <span>
                <strong>{counts.paid}</strong> paid
              </span>
            </div>
          </div>

          <InvoiceGrid
            rows={rows}
            onStatusChange={handleStatusChange}
            onDraftReminder={handleDraftReminder}
          />
        </section>
      </main>

      <footer className="site-footer">
        <span>PaidPilot · a PayPal AI Hackathon prototype</span>
        <span>Deterministic extraction · template reminders · Sandbox orders</span>
      </footer>

      {reminderDraft ? (
        <div
          className="reminder-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setReminderDraft(null);
            }
          }}
        >
          <aside
            className="reminder-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reminder-title"
          >
            <div className="reminder-head">
              <div>
                <p className="eyebrow">AI follow-up draft</p>
                <h2 id="reminder-title">A gentle nudge for {reminderDraft.clientName}</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="Close reminder panel"
                onClick={() => setReminderDraft(null)}
              >
                ×
              </button>
            </div>

            <p className="reminder-subtitle">
              Template-based, polite, and ready to paste into your email client. It mentions the
              amount, the due date, and the payment link.
            </p>

            <pre className="reminder-text">{reminderDraft.text}</pre>

            <div className="reminder-actions">
              <button type="button" className="btn primary" onClick={handleCopyReminder}>
                Copy draft
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setReminderDraft(null)}
              >
                Close
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
