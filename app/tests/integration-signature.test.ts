import test from 'node:test';
import assert from 'node:assert/strict';

// Secret figé AVANT import (les helpers lisent process.env à l'appel).
process.env.INTEGRATION_SIGNING_SECRET = 'test-signing-secret';

const {
  computeIntegrationSignature,
  buildIntegrationSignatureHeader,
  verifyIntegrationSignature,
} = await import('../lib/integration-auth');

const ts = '1700000000000';
const body = JSON.stringify({ dispatchId: 'd1', message: 'coucou' });

test('signature valide accepte le couple (timestamp, body) exact', () => {
  const header = buildIntegrationSignatureHeader(body, ts);
  assert.ok(header && header.startsWith('sha256='));
  assert.equal(verifyIntegrationSignature(body, ts, header), 'valid');
});

test('corps altéré → invalid (intégrité)', () => {
  const header = buildIntegrationSignatureHeader(body, ts);
  assert.equal(verifyIntegrationSignature(body + 'x', ts, header), 'invalid');
});

test('timestamp altéré → invalid (anti-rejeu lié à la fraîcheur)', () => {
  const header = buildIntegrationSignatureHeader(body, ts);
  assert.equal(verifyIntegrationSignature(body, '1700000000001', header), 'invalid');
});

test('signature absente ou malformée → invalid', () => {
  assert.equal(verifyIntegrationSignature(body, ts, null), 'invalid');
  assert.equal(verifyIntegrationSignature(body, ts, 'sha256=zzzz'), 'invalid');
});

test('mauvais secret → invalid', () => {
  const forged = `sha256=${computeIntegrationSignature(body, ts, 'autre-secret')}`;
  assert.equal(verifyIntegrationSignature(body, ts, forged), 'invalid');
});

test('sans secret configuré → not-configured (rétro-compat)', async () => {
  const prev = process.env.INTEGRATION_SIGNING_SECRET;
  delete process.env.INTEGRATION_SIGNING_SECRET;
  try {
    assert.equal(verifyIntegrationSignature(body, ts, 'sha256=whatever'), 'not-configured');
    assert.equal(buildIntegrationSignatureHeader(body, ts), null);
  } finally {
    process.env.INTEGRATION_SIGNING_SECRET = prev;
  }
});
