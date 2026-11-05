# PaidPilot

**An AI payment agent for solo devs and freelancers.**

Paste a messy client message, extract the invoice details, create a PayPal Sandbox
order, track it in an AG Grid dashboard, and draft a polite follow-up when a
payment goes overdue. Built for the PayPal AI Hackathon with Next.js, React, and
AG Grid.

The prototype is designed to run with **zero configuration**: with no PayPal
credentials set, every order is a clearly labelled mock and nothing leaves your
machine.

## What it does

1. **Extract** — `lib/extract.js` is a deterministic, local rules engine. It pulls
   `clientName`, `clientEmail`, `item`, `amount`, `currency`, `dueDate`, and a
   `confidence` score out of a raw email or DM. No API key, no model call.
2. **Create a PayPal order** — `lib/paypal.js` uses the PayPal Sandbox Orders v2
   API when credentials exist, and returns a mock order with the same shape when
   they do not.
3. **Track** — the dashboard is an editable AG Grid with Client, Item, Amount,
   Currency, Status, Due, PayPal Order, and Action columns. Status is a dropdown
   (`draft`, `sent`, `paid`, `overdue`), and three sample invoices are seeded.
4. **Follow up** — for any overdue row, **Draft reminder** runs
   `lib/reminder.js`, a template-based writer that politely mentions the amount,
   due date, and PayPal payment link. Copy the draft straight into your email
   client.

## Extraction engines

By default PaidPilot extracts invoices locally in `lib/extract.js` — deterministic
regex/rules, no API key, and no network call. This is the zero-config demo path,
and its responses include `engine: "local"`.

Set `OPENCODE_GO_API_KEY` to enable optional LLM extraction. `/api/extract` first
calls `lib/extractLLM.js` (OpenCode Go, `deepseek-v4.1-flash`) and returns the
validated fields with `engine: "llm"` and `confidence: 0.9`. The model is asked
for a strict JSON object; replies are parsed defensively (markdown fences are
stripped) and validated (positive numeric amount, three-letter currency, and a
`YYYY-MM-DD` due date). Any missing key, network or HTTP failure, malformed JSON,
or failed validation silently falls back to the local extractor, so extraction
always keeps working.

## Quick start

Requires Node.js 18.18+ (Node 20+ recommended). Dependencies are already listed
in `package.json`; no extra packages are needed.

```bash
# install dependencies if node_modules is missing
npm install

# run the dev server on port 3100
npm run dev
```

Open <http://localhost:3100>.

No environment variables are required. The header will read:

> PayPal Sandbox (mock — no credentials set)

Create an order and a new row appears in the grid with a mock PayPal order ID.

### Verify and build

```bash
node scripts/verify.mjs   # or: npm run verify
npm run build
```

`verify.mjs` imports the extractor and reminder writer directly and asserts that
the sample message produces amount `1200`, currency `USD`, a due date on
`2026-11-20`, and a reminder containing the amount.

## Environment variables

PaidPilot reads three optional variables, and only server-side:

| Variable | Required? | Purpose |
| --- | --- | --- |
| `PAYPAL_CLIENT_ID` | No | PayPal Sandbox REST app client ID |
| `PAYPAL_CLIENT_SECRET` | No | PayPal Sandbox REST app secret |
| `OPENCODE_GO_API_KEY` | No | Enables LLM extraction; unset means local-only extraction |

```bash
PAYPAL_CLIENT_ID=your_sandbox_client_id \
PAYPAL_CLIENT_SECRET=your_sandbox_secret \
npm run dev
```

Never commit real credentials. There are no hard-coded secrets in this repo, and
`/api/paypal/mode` only returns `{ "live": true|false }` — never a token, client
ID, or secret.

## Mock vs live PayPal

| | No credentials (default) | Both credentials set |
| --- | --- | --- |
| Mode badge | `PayPal Sandbox (mock — no credentials set)` | `PayPal Sandbox (live)` |
| Order API | Local mock object, no network request | OAuth client-credentials + `POST /v2/checkout/orders` |
| Order ID | `MOCK-...` | Real PayPal Sandbox order ID |
| Payment link | `#mock` placeholder | `payer-action` / `approve` link from PayPal |
| Money moved | None | None — Sandbox only |

A mock order has the same useful shape as a live one:

```json
{
  "id": "MOCK-...",
  "status": "CREATED",
  "mock": true,
  "links": [
    { "rel": "payer-action", "href": "#mock" },
    { "rel": "approve", "href": "#mock" }
  ]
}
```

The live path requests an OAuth token from
`https://api-m.sandbox.paypal.com/v1/oauth2/token`, then creates an order with
`intent: "CAPTURE"` and one purchase unit containing the amount and item
description. Both requests use a 15-second timeout. Errors are returned to the
browser as friendly messages, never as raw OAuth responses.

## API routes

| Route | Method | Body / result |
| --- | --- | --- |
| `/api/extract` | `POST` | `{ "text": "..." }` → extracted invoice fields + `confidence` + `engine` |
| `/api/paypal/order` | `POST` | `{ "amount": 1200, "currency": "USD", "item": "..." }` → order |
| `/api/paypal/mode` | `GET` | `{ "live": false }` with no secrets |

Invalid or empty input returns a `400` with a readable `error` field.

## Extraction rules

The extractor intentionally favours precision over recall:

- **Money** — `$1,200`, `1200 USD`, `USD 1200`, `1200 dollars`, and keyword-led
  amounts such as `total: 1200`. Currency symbols and ISO codes are mapped to a
  three-letter code; USD is the fallback.
- **Email** — first valid email address in the message.
- **Dates** — `2026-11-20`, `Nov 20, 2026`, `November 20`, `20 November 2026`,
  and `11/20/2026`. Dates near cues like “by”, “due”, or “before” win. A missing
  year is inferred, rolling forward if the date is already well in the past.
- **Names** — sign-offs (“Thanks, Maya Chen”), introductions (“This is …”,
  “My name is …”), signature lines, then an email-local-part fallback.
- **Item** — phrases after “for”, “covering”, “regarding”, or “project is”,
  scored for freelancer-friendly keywords and stripped of money/date noise.
- **Confidence** — a weighted score based on which fields were found.

## Tech stack

- Next.js 15.5 (App Router, JavaScript only)
- React 19
- AG Grid Community / React 34.3 (Alpine legacy theme)
- No additional dependencies

## Project structure

```text
app/
  api/
    extract/route.js        POST raw text -> invoice fields
    paypal/mode/route.js    GET { live }
    paypal/order/route.js   POST invoice -> mock or live order
  InvoiceGrid.js            AG Grid client component
  globals.css               app + grid styling
  layout.js                 root layout, metadata, AG Grid CSS
  page.js                   client dashboard and demo flow
lib/
  extract.js                deterministic extraction
  extractLLM.js             optional LLM extraction with local fallback
  paypal.js                 Sandbox Orders v2 client + mock fallback
  reminder.js               template-based reminder writer
scripts/
  verify.mjs                extraction/reminder assertions
```

## License

MIT — see [LICENSE](./LICENSE).
