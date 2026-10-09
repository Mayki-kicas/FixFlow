import test from 'node:test';
import assert from 'node:assert/strict';

// Client Prisma instancié à l'import (pas de connexion tant qu'aucune requête).
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://x:x@localhost:5432/x';

const { shouldSendQuoteReminder } = await import('../lib/quote-reminders');

const DAY = 24 * 60 * 60 * 1000;
const now = new Date(2026, 1, 20); // 20 févr. 2026
const intervalMs = 2 * DAY;

test('pas d\'échéance => pas de relance', () => {
  assert.equal(shouldSendQuoteReminder({ quoteDeadline: null, lastRemindedAt: null, intervalMs, now }), false);
});

test('échéance non dépassée => pas de relance', () => {
  const future = new Date(now.getTime() + DAY);
  assert.equal(shouldSendQuoteReminder({ quoteDeadline: future, lastRemindedAt: null, intervalMs, now }), false);
});

test('dépassée + jamais relancé => relance', () => {
  const past = new Date(now.getTime() - DAY);
  assert.equal(shouldSendQuoteReminder({ quoteDeadline: past, lastRemindedAt: null, intervalMs, now }), true);
});

test('dépassée + relancé récemment (< intervalle) => pas de relance', () => {
  const past = new Date(now.getTime() - 5 * DAY);
  const recent = new Date(now.getTime() - 1 * DAY); // 1j < 2j
  assert.equal(shouldSendQuoteReminder({ quoteDeadline: past, lastRemindedAt: recent, intervalMs, now }), false);
});

test('dépassée + relancé il y a longtemps (>= intervalle) => relance', () => {
  const past = new Date(now.getTime() - 5 * DAY);
  const old = new Date(now.getTime() - 3 * DAY); // 3j >= 2j
  assert.equal(shouldSendQuoteReminder({ quoteDeadline: past, lastRemindedAt: old, intervalMs, now }), true);
});
