# Devpost submission copy — PaidPilot (PayPal AI Hackathon)

## Project name
PaidPilot

## Elevator pitch
Paste a client message — PaidPilot's AI extracts the invoice, creates a PayPal payment link, tracks who's paid in a live dashboard, and chases late payers for you.

## About the project (Project Story)

## Inspiration
Getting paid is the least fun part of being a solo developer. The work ships, then the money stalls in chat threads: "Can you send me an invoice?" — followed by manual invoicing, a spreadsheet you forget to update, and the awkward "just following up…" message you rewrite ten times. I run my own products as an independent developer, and chasing payments eats hours that should go into building. I wanted an agent that treats getting paid like a pipeline, not a chore.

## What it does
PaidPilot is an AI payment agent for solo devs and freelancers:
1. **Paste a client message** — the messy email or chat where a client agrees to pay.
2. **The extraction engine reads it** and pulls out the client name, email, item, amount, currency and due date, with a confidence score, into a pre-filled invoice form you can edit.
3. **One click creates a PayPal order** (Sandbox Orders v2 API) and generates the payment link.
4. **An AG Grid dashboard tracks every invoice** — draft, sent, paid, overdue — with inline status editing, totals and filters, so "who owes me what" is always one glance away.
5. **For overdue invoices, PaidPilot drafts the follow-up for you** — a polite, firm reminder with the amount, due date and payment link, ready to send.

## How I built it
Next.js 15 + React 19, all JavaScript. The PayPal integration uses the Sandbox OAuth client-credentials flow and the Orders v2 API, and it is designed to degrade honestly: with no credentials configured it returns a clearly-labelled mock order with the exact same response shape, so judges (and I) can run the full flow anywhere and switch to live Sandbox by setting two env vars. AG Grid Community powers the dashboard — it is the product's control surface, not decoration. The prototype was built with an AI coding agent (DeepSeek V4.1) working from a written spec, and every module was verified with an automated check script (extraction and reminder assertions, 14/14 passing) plus a production build.

## Challenges I ran into
PayPal's API shape and a judge-friendly demo pull in opposite directions: a real integration needs credentials a judge won't have. The mock-with-identical-shape pattern solved it — one code path, two modes, zero fake claims. The other challenge was extraction quality: client messages are unstructured, so amounts hide inside "$1,200 USD", dates arrive as "by Nov 20", and the item is whatever follows "for the…". A deterministic, test-covered extractor beat a vague prompt here.

## Accomplishments that I'm proud of
The full loop — message in, money tracked, late payer chased — works end to end today, verified by automated checks rather than hope. And the architecture leaves a clean seam to plug a live LLM into the extraction step without touching the rest.

## What I learned
Payment UX is mostly psychology: the invoice is easy, the follow-up is the product. Building the reminder generator taught me more about why freelancers get paid late than the payment API did.

## What's next for PaidPilot
Live LLM extraction as an alternative engine, PayPal webhooks so "paid" updates itself the second money lands, invoicing API support, and multi-currency reminder tones (polite → firm) based on days overdue.

## Built with tags
next.js, react, javascript, node.js, paypal-api, ag-grid

## Try it out links (fill later)
- GitHub repo: TBD (public, MIT license already in repo)
- Hosted demo: TBD

## Demo video (fill later)
YouTube, under 3 minutes, public/unlisted.

## Additional info (step 4) — prepared answers

- Submitter Type: Individual
- Country of Residence: China
- Canada province: N/A
- Organization Name: N/A
- Project new/existed before Oct 1, 2026: New
- If existed before: N/A
- Meets technology requirement: "PayPal (required tool): PaidPilot integrates the PayPal Developer Platform in the free Sandbox environment — OAuth 2.0 client-credentials flow + Checkout Orders v2 API — to create a payment order and payer approval link for every invoice, and the dashboard tracks each order's status. AI (required tool): PaidPilot's extraction engine turns an unstructured client message into structured invoice data (client name, email, item, amount, currency, due date, confidence score) that drives the whole flow, and generates the late-payment follow-up drafts. The prototype itself was built with an AI coding agent (DeepSeek V4.1) from a written spec and verified with automated tests."
- Sponsor tools: AG Grid
- Testing instructions: "No credentials needed. The hosted demo runs in PayPal Sandbox mock mode with no env vars: paste the prefilled sample client message, click Extract, then Create PayPal payment link, change a status to Overdue and click Draft reminder. To run live Sandbox mode locally, set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET and restart — see README."
- PayPal integration experience rating: 8
- Rating feedback: "Sandbox onboarding and the Orders v2 docs were clear, and the OAuth flow took minutes. The main friction was designing a demo that judges can run without my credentials — a first-class 'demo mode' pattern in the docs would help."
- Open to contact: Yes
- AG Grid experience: "AG Grid Community was the fastest way to get a real control surface: column definitions, inline status editing with a dropdown editor, sorting and filtering out of the box, and the Alpine theme matched the app with almost no custom CSS. The dashboard went from idea to a working grid in one session."
- Eligibility checkboxes: all three ticked
- AI tools leveraged: "DeepSeek V4.1 (via the DeepSeek Harness agent framework, routed through my OpenCode Go subscription) as the coding agent that implemented the prototype from a written spec; I directed, reviewed and verified its output with automated tests (14/14 checks + production build)."
- Level of learning: highest option
- AI value for career: Yes

## Demo video script (<3 min, target ~2:20) — read the EN lines, actions in brackets

[0:00–0:12 — screen: PaidPilot homepage, sample message visible]
"Hi, I'm Persona. I built PaidPilot — an AI payment agent for freelancers and solo developers. Getting paid usually starts with a messy message like this one."

[0:12–0:35 — click Extract; fields fill in]
"Instead of typing an invoice by hand, I paste the client's message and click Extract. PaidPilot pulls out the client name, email, the work, the amount, the currency, and the due date — with a confidence score. The extraction runs on a local engine by default, or a real LLM when you plug in an API key."

[0:35–0:58 — click Create PayPal payment link; order card appears]
"One more click creates a real PayPal order through the PayPal Sandbox API — order ID, status, and an approval link I can send to the client. No credentials? It falls back to a clearly labeled mock mode, same shape, so anyone can try the demo."

[0:58–1:25 — scroll to AG Grid dashboard; sort/filter; change a status dropdown to Overdue]
"Every invoice lands in this live dashboard, built with AG Grid. I can sort, filter, and edit statuses inline. This one is overdue — and chasing late payments is the worst part of freelancing."

[1:25–1:50 — click Draft reminder; reminder text appears]
"So PaidPilot drafts the follow-up for me: polite, firm, with the amount, the due date, and the payment link already inside. I just review and send."

[1:50–2:15 — back to full dashboard; mouse over the stats]
"To recap: message in, invoice out, PayPal link created, payment tracked, late payers chased — one flow, no spreadsheets, no awkward manual emails."

[2:15–2:25 — end screen: repo URL on screen]
"PaidPilot is open source — the link is on screen and in the Devpost page. Thanks for watching!"

Recording notes: record at 1080p, browser zoom 110–125%, close other tabs; if you stumble on a line, pause 2 seconds and re-read just that line — easy to cut later.
