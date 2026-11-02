import { NextResponse } from 'next/server';
import paypal from '@/lib/paypal';

const { createOrder } = paypal;

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const rawAmount = body?.amount;
  const numericAmount =
    typeof rawAmount === 'number'
      ? rawAmount
      : Number(String(rawAmount ?? '').replace(/[^0-9.-]/g, ''));

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return NextResponse.json({ error: 'A positive amount is required.' }, { status: 400 });
  }

  const currency = String(body?.currency || 'USD').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json(
      { error: 'Currency must be a three-letter ISO code (for example USD).' },
      { status: 400 }
    );
  }

  const item =
    typeof body?.item === 'string' && body.item.trim() ? body.item.trim() : 'Freelance services';

  try {
    const order = await createOrder({ amount: numericAmount, currency, item });
    return NextResponse.json(order);
  } catch (error) {
    // Never surface credentials or raw OAuth responses to the browser.
    return NextResponse.json(
      { error: error?.message || 'Could not create the PayPal order.' },
      { status: 502 }
    );
  }
}
