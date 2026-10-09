import test from 'node:test';
import assert from 'node:assert/strict';
import { isPlanDue, advanceDueDate, isMeterPlanDue } from '@/lib/maintenance-core';

const now = new Date('2026-09-07T10:00:00.000Z');

test('isPlanDue: pas dû si échéance - anticipation est dans le futur', () => {
  const due = new Date('2026-09-20T10:00:00.000Z'); // dans 13 j
  assert.equal(isPlanDue(due, 7, now), false); // fenêtre s'ouvre le 13/09
});

test('isPlanDue: dû dès l\'entrée dans la fenêtre d\'anticipation', () => {
  const due = new Date('2026-09-10T10:00:00.000Z'); // dans 3 j
  assert.equal(isPlanDue(due, 7, now), true); // fenêtre ouverte depuis le 03/09
});

test('isPlanDue: dû si échéance dépassée (sans anticipation)', () => {
  const due = new Date('2026-09-05T10:00:00.000Z');
  assert.equal(isPlanDue(due, 0, now), true);
});

test('advanceDueDate: une date future reste inchangée', () => {
  const future = new Date('2026-09-20T10:00:00.000Z');
  assert.equal(advanceDueDate(future, 30, now).toISOString(), future.toISOString());
});

test('advanceDueDate: avance d\'un intervalle quand l\'échéance vient de passer', () => {
  const due = new Date('2026-09-05T10:00:00.000Z');
  assert.equal(advanceDueDate(due, 30, now).toISOString(), '2026-10-05T10:00:00.000Z');
});

test('isMeterPlanDue: dû quand usage depuis baseline >= intervalle', () => {
  assert.equal(isMeterPlanDue(1500, 1000, 500), true); // +500
  assert.equal(isMeterPlanDue(1499, 1000, 500), false); // +499
  assert.equal(isMeterPlanDue(2200, 1000, 500), true); // dépassé
});

test('isMeterPlanDue: pas de relevé / intervalle invalide => non dû', () => {
  assert.equal(isMeterPlanDue(null, 1000, 500), false);
  assert.equal(isMeterPlanDue(1500, 1000, 0), false);
  assert.equal(isMeterPlanDue(1500, null, 500), false); // baseline=current -> 0 < 500
});

test('advanceDueDate: rattrape plusieurs occurrences manquées en une fois', () => {
  const due = new Date('2026-06-01T10:00:00.000Z'); // ~98 j avant now, pas de 30 j
  const next = advanceDueDate(due, 30, now);
  assert.ok(next.getTime() > now.getTime());
  // Série +30 j depuis le 01/06 : 01/07, 31/07, 30/08, 29/09 (1er futur après le 07/09).
  assert.equal(next.toISOString(), '2026-09-29T10:00:00.000Z');
});
