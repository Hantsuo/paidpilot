import { NextResponse } from 'next/server';
import paypal from '@/lib/paypal';

const { isPayPalLive } = paypal;

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    { live: isPayPalLive() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
