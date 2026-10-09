import test from 'node:test';
import assert from 'node:assert/strict';

// Le module importe prisma (pas de connexion tant qu'aucune requête).
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x:x@localhost:5432/x';

const { isWithinRateLimit } = await import('../lib/login-throttle');

const MIN = 60_000;
const now = 10 * MIN;
const windowMs = 10 * MIN;
const max = 3;

test('aucune tentative => autorisé', () => {
  assert.equal(isWithinRateLimit([], now, windowMs, max), true);
});

test('sous le seuil (dans la fenêtre) => autorisé', () => {
  assert.equal(isWithinRateLimit([now - MIN, now - 2 * MIN], now, windowMs, max), true);
});

test('au seuil (dans la fenêtre) => bloqué', () => {
  assert.equal(isWithinRateLimit([now - MIN, now - 2 * MIN, now - 3 * MIN], now, windowMs, max), false);
});

test('les tentatives hors fenêtre ne comptent pas', () => {
  // 3 anciennes (hors fenêtre) + 1 récente => 1 seule compte => autorisé.
  const old = now - 20 * MIN;
  assert.equal(isWithinRateLimit([old, old, old, now - MIN], now, windowMs, max), true);
});

test('borne de fenêtre : exactement windowMs => compte encore', () => {
  const atEdge = now - windowMs; // now - t == windowMs, <= windowMs => récent
  assert.equal(isWithinRateLimit([atEdge, atEdge, atEdge], now, windowMs, max), false);
});
