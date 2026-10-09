import { NextRequest, NextResponse } from 'next/server';
import { ingestExternalQuote } from '@/lib/external-quote';
import {
  isTimestampFresh,
  isValidIntegrationToken,
  verifyIntegrationSignature,
} from '@/lib/integration-auth';

export async function POST(request: NextRequest) {
  if (!isValidIntegrationToken(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const timestampHeader = request.headers.get('x-request-timestamp');
  if (!isTimestampFresh(timestampHeader)) {
    return NextResponse.json({ error: 'Stale timestamp' }, { status: 401 });
  }

  // Corps brut pour vérifier la signature HMAC AVANT tout parsing.
  const rawBody = await request.text();
  const signatureState = verifyIntegrationSignature(
    rawBody,
    timestampHeader,
    request.headers.get('x-signature'),
  );
  // Fail-closed en production : la signature HMAC est OBLIGATOIRE (pas de secret => rejet).
  // En dev, l'absence de secret reste tolérée (token + timestamp).
  if (
    signatureState === 'invalid' ||
    (signatureState === 'not-configured' && process.env.NODE_ENV === 'production')
  ) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const required = ['dispatchId', 'externalQuoteId'];
  for (const key of required) {
    if (!payload?.[key]) {
      return NextResponse.json({ error: `Missing field: ${key}` }, { status: 400 });
    }
  }

  try {
    const result = await ingestExternalQuote(payload);
    if (result.status === 'DISPATCH_NOT_FOUND') {
      return NextResponse.json({ error: 'Dispatch not found' }, { status: 404 });
    }
    if (result.status === 'NO_PENDING_QUOTE') {
      return NextResponse.json({ error: 'No pending quote request for this dispatch' }, { status: 409 });
    }
    return NextResponse.json(result);
  } catch (error) {
    // Ne pas exposer le détail interne (Prisma/DB) au client.
    console.error('[integration] quote ingestion failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
