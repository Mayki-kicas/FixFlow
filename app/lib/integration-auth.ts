import { createHmac, timingSafeEqual } from 'node:crypto';

// Compare un header "Bearer <valeur>" au secret attendu, en temps constant.
function matchesBearerToken(authHeader: string | null, expected: string | undefined) {
  if (!expected || !authHeader) return false;
  if (!authHeader.startsWith('Bearer ')) return false;
  const provided = authHeader.slice('Bearer '.length).trim();

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length) return false;

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

export function isValidIntegrationToken(authHeader: string | null) {
  return matchesBearerToken(authHeader, process.env.INTEGRATION_SHARED_TOKEN);
}

// Token des endpoints cron internes (file email + rappels d'échéance).
export function isValidCronToken(authHeader: string | null) {
  return matchesBearerToken(authHeader, process.env.INTERNAL_CRON_TOKEN);
}

export function isTimestampFresh(timestampHeader: string | null, maxSkewMs = 60_000) {
  if (!timestampHeader) return false;
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  return Math.abs(Date.now() - ts) <= maxSkewMs;
}

// --- Signature HMAC des échanges avec l'app mainteneur externe (H2) ---------
//
// La signature couvre `${timestamp}.${rawBody}` : elle prouve la possession du
// secret de signature ET l'intégrité du corps (un token Bearer seul ne protège
// pas le payload contre une altération en transit). Secret DISTINCT du token
// Bearer pour cloisonner les expositions.

export function computeIntegrationSignature(rawBody: string, timestamp: string, secret: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
}

// Construit l'en-tête `x-signature` si un secret de signature est configuré.
// Renvoie null sinon (rien à signer — l'app externe n'est pas encore branchée).
export function buildIntegrationSignatureHeader(rawBody: string, timestamp: string): string | null {
  const secret = process.env.INTEGRATION_SIGNING_SECRET;
  if (!secret) return null;
  return `sha256=${computeIntegrationSignature(rawBody, timestamp, secret)}`;
}

// Vérifie l'en-tête `x-signature` (format "sha256=<hex>") sur `${timestamp}.${rawBody}`.
//  - 'valid'          : signature correcte
//  - 'invalid'        : secret configuré mais signature absente/malformée/incorrecte
//  - 'not-configured' : aucun INTEGRATION_SIGNING_SECRET défini (rétro-compat) →
//                       l'appelant retombe sur token+timestamp seuls.
export function verifyIntegrationSignature(
  rawBody: string,
  timestampHeader: string | null,
  signatureHeader: string | null,
): 'valid' | 'invalid' | 'not-configured' {
  const secret = process.env.INTEGRATION_SIGNING_SECRET;
  if (!secret) return 'not-configured';
  if (!signatureHeader || !timestampHeader) return 'invalid';

  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader;

  const expected = computeIntegrationSignature(rawBody, timestampHeader, secret);
  const providedBuffer = Buffer.from(provided, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (providedBuffer.length === 0 || providedBuffer.length !== expectedBuffer.length) {
    return 'invalid';
  }
  return timingSafeEqual(providedBuffer, expectedBuffer) ? 'valid' : 'invalid';
}

