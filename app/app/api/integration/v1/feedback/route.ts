import { NextRequest, NextResponse } from 'next/server';
import { ingestExternalFeedback } from '@/lib/external-feedback';
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

  // Corps brut nécessaire pour vérifier la signature HMAC AVANT tout parsing.
  const rawBody = await request.text();

  // H2 : signature HMAC sur `${timestamp}.${rawBody}`. Imposée dès qu'un secret
  // de signature est configuré ; sinon on retombe sur token+timestamp (rétro-compat).
  const signatureState = verifyIntegrationSignature(
    rawBody,
    timestampHeader,
    request.headers.get('x-signature'),
  );
  // Fail-closed en production : signature HMAC obligatoire (pas de secret => rejet).
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

  const required = ['dispatchId', 'externalTicketId', 'externalMessageId', 'maintainer', 'message', 'createdAt'];
  for (const key of required) {
    if (!payload?.[key]) {
      return NextResponse.json({ error: `Missing field: ${key}` }, { status: 400 });
    }
  }

  try {
    const result = await ingestExternalFeedback(payload);
    return NextResponse.json(result);
  } catch (error) {
    // Ne pas exposer le détail interne (Prisma/DB) au client.
    console.error('[integration] feedback ingestion failed', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

