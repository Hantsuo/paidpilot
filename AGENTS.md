# PaidPilot — build brief

You are building a hackathon prototype in this directory. Stack is already installed:
Next.js 15.5 + React 19 + ag-grid-community/react 34.3 (see package.json, node_modules present).
Do NOT reinstall or change major versions. Dev port: 3100 (`npm run dev`), build: `npm run build`.

## Product (PayPal AI Hackathon, deadline 2026-11-12 12:00 PT)

PaidPilot: an AI payment agent for solo devs / freelancers.
Flow: user pastes a raw client message -> AI extracts {clientName, clientEmail, item, amount, currency, dueDate}
-> one click creates a PayPal Sandbox order/invoice -> AG Grid dashboard tracks invoices
(draft / sent / paid / overdue) -> for overdue rows, AI drafts a polite follow-up reminder.

## Required pieces

1. `lib/extract.js` — deterministic local extractor (regex/rules, NO external API key needed):
   money amounts like $1,200 / 1200 USD, emails, dates like "by Nov 20" / "2026-11-20",
   client name heuristics. Export `extractInvoice(text)` returning the fields above plus `confidence`.
   Route: `app/api/extract/route.js` POST {text} -> JSON of extractInvoice.
2. `lib/paypal.js` — PayPal Sandbox client using ONLY env vars PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET:
   OAuth client_credentials to https://api-m.sandbox.paypal.com/v1/oauth2/token, then
   POST /v2/checkout/orders (intent CAPTURE, one purchase_unit with amount).
   If env vars are missing, return a clearly-labelled MOCK order object with the SAME shape
   ({id, status:"CREATED", mock:true, links:[{rel:"payer-action"/"approve", href:"#mock"}]}).
   Route: `app/api/paypal/order/route.js` POST {amount, currency, item} -> that JSON.
3. `app/page.js` (client component) + `app/layout.js` + `app/globals.css`:
   - Textarea for the client message, with a prefilled realistic sample message.
   - "Extract with AI" button -> fills an editable invoice form from /api/extract.
   - "Create PayPal payment link" button -> /api/paypal/order, adds a row to the grid.
   - AG Grid (ag-grid-react, alpine theme CSS from ag-grid-community/styles) with columns:
     Client, Item, Amount, Currency, Status, Due, PayPal Order, Action.
     Status editable via dropdown (draft/sent/paid/overdue). Seed 3 sample rows.
   - "Draft reminder" action per overdue row: calls `lib/reminder.js` `draftReminder(invoice)`
     (template-based, polite, mentions amount + due date + payment link) and shows it in a panel.
   - Header must state the PayPal mode: "PayPal Sandbox (mock — no credentials set)" or
     "PayPal Sandbox (live)" based on a `mock` flag from the order response / a small
     `app/api/paypal/mode/route.js` GET that returns {live: boolean} (never return secrets).
4. `scripts/verify.mjs` — node script that imports extractInvoice + draftReminder and asserts:
   sample text extracts amount 1200, currency USD, dueDate containing 2026-11-20;
   reminder text contains the amount. Print ALL PASS or fail loudly.
5. `README.md` — what it is, how to run, env vars, mock vs live PayPal, demo script outline (<3 min).
   Plus an MIT `LICENSE` file (public repo requirement).

## Rules
- Plain JavaScript (no TypeScript), no extra dependencies beyond package.json.
- Everything must work with NO env vars set (mock mode). No hard-coded secrets, ever.
- After writing code, run `node scripts/verify.mjs` and `npm run build` yourself and fix errors until both pass.
