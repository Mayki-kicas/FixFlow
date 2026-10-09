import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeQuoteDeadline,
  quoteDelayDays,
  isQuoteOverdue,
  isHighPriority,
  PRIORITY_META,
  PRIORITIES,
} from '@/lib/priority';

const category = { p1DelayDays: 3, p2DelayDays: 7, p3DelayDays: null };

test('quoteDelayDays: délai par priorité selon la catégorie (P3 = à définir)', () => {
  assert.equal(quoteDelayDays('P1', category), 3);
  assert.equal(quoteDelayDays('P2', category), 7);
  assert.equal(quoteDelayDays('P3', category), null);
});

test('computeQuoteDeadline: base + délai, null si à définir', () => {
  const base = new Date(2026, 1, 1); // 1 févr. 2026 (local)
  const d1 = computeQuoteDeadline(base, 'P1', category);
  assert.ok(d1);
  assert.equal(d1!.getDate(), 4); // +3 j
  const d2 = computeQuoteDeadline(base, 'P2', category);
  assert.equal(d2!.getDate(), 8); // +7 j
  // P3 sans délai => pas d'échéance
  assert.equal(computeQuoteDeadline(base, 'P3', category), null);
});

test('computeQuoteDeadline: passage de mois géré', () => {
  const base = new Date(2026, 0, 30); // 30 janv.
  const d = computeQuoteDeadline(base, 'P2', category); // +7 j => 6 févr.
  assert.equal(d!.getMonth(), 1);
  assert.equal(d!.getDate(), 6);
});

test('isQuoteOverdue: échéance passée = en retard, futur/null = non', () => {
  const now = new Date(2026, 1, 10);
  assert.equal(isQuoteOverdue(new Date(2026, 1, 4), now), true);
  assert.equal(isQuoteOverdue(new Date(2026, 1, 20), now), false);
  assert.equal(isQuoteOverdue(null, now), false);
  assert.equal(isQuoteOverdue(undefined, now), false);
});

test('isHighPriority: seul P1 est prioritaire', () => {
  assert.equal(isHighPriority('P1'), true);
  assert.equal(isHighPriority('P2'), false);
  assert.equal(isHighPriority('P3'), false);
});

test('PRIORITY_META couvre les 3 priorités', () => {
  assert.deepEqual(PRIORITIES, ['P1', 'P2', 'P3']);
  for (const p of PRIORITIES) {
    assert.ok(PRIORITY_META[p].short);
    assert.ok(PRIORITY_META[p].color);
  }
});
