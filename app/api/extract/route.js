import { NextResponse } from 'next/server';
import extractor from '@/lib/extract';
import llmExtractor from '@/lib/extractLLM';

const { extractInvoice } = extractor;
const { extractInvoiceLLM } = llmExtractor;

export const dynamic = 'force-dynamic';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const text = typeof body?.text === 'string' ? body.text : '';
  if (!text.trim()) {
    return NextResponse.json(
      { error: 'Paste a client message in the "text" field.' },
      { status: 400 }
    );
  }
  if (text.length > 20_000) {
    return NextResponse.json({ error: 'Message is too long (20,000 characters max).' }, { status: 413 });
  }

  let invoice = null;
  if (process.env.OPENCODE_GO_API_KEY) {
    try {
      invoice = await extractInvoiceLLM(text);
    } catch {
      // extractInvoiceLLM is designed never to throw; this is a final safety net.
      invoice = null;
    }
  }

  // Fall back to the deterministic local extractor when the LLM is disabled,
  // unavailable, or returned anything we could not validate.
  return NextResponse.json(invoice || extractInvoice(text));
}
