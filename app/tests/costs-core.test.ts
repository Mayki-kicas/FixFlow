import test from 'node:test';
import assert from 'node:assert/strict';
import { computeTicketCost, formatMinutes } from '@/lib/costs-core';

test('computeTicketCost: main d\'œuvre valorisée + lignes', () => {
  const r = computeTicketCost({
    workLogMinutes: 90, // 1h30
    laborRateCents: 4500, // 45 €/h
    costLines: [
      { amountCents: 4000, quantity: 1 }, // pièce 40 €
      { amountCents: 1000, quantity: 2 }, // 2 x 10 €
    ],
  });
  assert.equal(r.laborCents, 6750); // 1.5 h * 4500
  assert.equal(r.linesCents, 6000); // 4000 + 2000
  assert.equal(r.totalCents, 12750);
});

test('computeTicketCost: sans taux horaire => main d\'œuvre non valorisée', () => {
  const r = computeTicketCost({ workLogMinutes: 120, laborRateCents: null, costLines: [] });
  assert.equal(r.laborCents, 0);
  assert.equal(r.totalCents, 0);
});

test('computeTicketCost: arrondi au centime', () => {
  const r = computeTicketCost({ workLogMinutes: 20, laborRateCents: 5000, costLines: [] });
  assert.equal(r.laborCents, Math.round((20 / 60) * 5000)); // 1667
});

test('formatMinutes', () => {
  assert.equal(formatMinutes(90), '1 h 30');
  assert.equal(formatMinutes(60), '1 h');
  assert.equal(formatMinutes(45), '45 min');
});
