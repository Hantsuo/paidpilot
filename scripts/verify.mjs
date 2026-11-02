#!/usr/bin/env node

import extractor from '../lib/extract.js';
import reminder from '../lib/reminder.js';

const { extractInvoice } = extractor;
const { draftReminder } = reminder;

const SAMPLE = `Hi! This is Maya Chen from Northstar Labs. Could you send an invoice for $1,200 USD for the dashboard redesign? Payment is due by Nov 20, 2026. You can reach me at maya@northstarlabs.io.

Thanks,
Maya Chen`;

let passed = 0;
let failed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('PaidPilot verification\n');
console.log(`Sample message: ${SAMPLE.length} chars\n`);

const invoice = extractInvoice(SAMPLE);

check('extractInvoice is a function', typeof extractInvoice === 'function');
check(
  'amount extracts to 1200',
  invoice.amount === 1200,
  `received ${JSON.stringify(invoice.amount)}`
);
check(
  'currency extracts to USD',
  invoice.currency === 'USD',
  `received ${JSON.stringify(invoice.currency)}`
);
check(
  'dueDate contains 2026-11-20',
  typeof invoice.dueDate === 'string' && invoice.dueDate.includes('2026-11-20'),
  `received ${JSON.stringify(invoice.dueDate)}`
);
check(
  'client name extracts sensibly',
  invoice.clientName === 'Maya Chen',
  `received ${JSON.stringify(invoice.clientName)}`
);
check(
  'client email extracts sensibly',
  invoice.clientEmail === 'maya@northstarlabs.io',
  `received ${JSON.stringify(invoice.clientEmail)}`
);
check(
  'item extracts sensibly',
  /dashboard redesign/i.test(invoice.item),
  `received ${JSON.stringify(invoice.item)}`
);
check(
  'confidence is a number between 0 and 1',
  typeof invoice.confidence === 'number' && invoice.confidence > 0 && invoice.confidence <= 1,
  `received ${JSON.stringify(invoice.confidence)}`
);

const reminderText = draftReminder({
  ...invoice,
  paymentLink: 'https://www.sandbox.paypal.com/checkoutnow?token=VERIFY-ORDER',
});

check('draftReminder is a function', typeof draftReminder === 'function');
check('reminder is a non-empty string', typeof reminderText === 'string' && reminderText.length > 40);
check(
  'reminder contains the amount',
  reminderText.includes('1,200.00'),
  'expected $1,200.00 in the draft'
);
check(
  'reminder contains the due date',
  reminderText.includes('November 20, 2026'),
  'expected the friendly due date in the draft'
);
check(
  'reminder contains the payment link',
  reminderText.includes('https://www.sandbox.paypal.com/checkoutnow?token=VERIFY-ORDER')
);
check(
  'reminder sounds polite',
  /gently follow up|no pressure|thank you/i.test(reminderText)
);

console.log('');
if (failed > 0) {
  console.error(`VERIFY FAILED — ${failed} check(s) failed, ${passed} passed.`);
  process.exit(1);
}

console.log(`ALL PASS — ${passed}/${passed} checks passed.`);
