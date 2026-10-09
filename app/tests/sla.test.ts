import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCorrectiveDueDate,
  computeFirstResponseDueAt,
  isFirstResponseOverdue,
  isResolutionOverdue,
} from '@/lib/sla';

const base = new Date('2026-09-07T10:00:00.000Z');

test('computeCorrectiveDueDate: base + heures ; null si pas de SLA', () => {
  assert.equal(computeCorrectiveDueDate(base, 4)?.toISOString(), '2026-09-07T14:00:00.000Z');
  assert.equal(computeCorrectiveDueDate(base, 72)?.toISOString(), '2026-09-10T10:00:00.000Z');
  assert.equal(computeCorrectiveDueDate(base, null), null);
  assert.equal(computeCorrectiveDueDate(base, undefined), null);
});

test('computeCorrectiveDueDate ne mute pas la date d\'entrée', () => {
  const snapshot = base.getTime();
  computeCorrectiveDueDate(base, 4);
  assert.equal(base.getTime(), snapshot);
});

test('computeFirstResponseDueAt: base + heures', () => {
  assert.equal(computeFirstResponseDueAt(base, 1).toISOString(), '2026-09-07T11:00:00.000Z');
});

test('isFirstResponseOverdue: en retard si non pris en charge et échéance dépassée', () => {
  const due = new Date('2026-09-07T11:00:00.000Z');
  const after = new Date('2026-09-07T12:00:00.000Z');
  const before = new Date('2026-09-07T10:30:00.000Z');
  assert.equal(isFirstResponseOverdue(due, null, after), true);
  assert.equal(isFirstResponseOverdue(due, null, before), false);
});

test('isFirstResponseOverdue: jamais en retard si déjà pris en charge', () => {
  const due = new Date('2026-09-07T11:00:00.000Z');
  const after = new Date('2026-09-07T12:00:00.000Z');
  assert.equal(isFirstResponseOverdue(due, new Date('2026-09-07T10:45:00.000Z'), after), false);
});

test('isFirstResponseOverdue: pas d\'échéance => jamais en retard', () => {
  assert.equal(isFirstResponseOverdue(null, null, new Date()), false);
});

test('isResolutionOverdue: en retard si échéance dépassée et non clos', () => {
  const due = new Date('2026-09-07T14:00:00.000Z');
  const after = new Date('2026-09-07T15:00:00.000Z');
  const before = new Date('2026-09-07T13:00:00.000Z');
  assert.equal(isResolutionOverdue(due, null, after), true);
  assert.equal(isResolutionOverdue(due, null, before), false);
});

test('isResolutionOverdue: jamais en retard si clos', () => {
  const due = new Date('2026-09-07T14:00:00.000Z');
  const after = new Date('2026-09-07T15:00:00.000Z');
  assert.equal(isResolutionOverdue(due, new Date('2026-09-07T13:30:00.000Z'), after), false);
});

test('isResolutionOverdue: pas d\'échéance => jamais en retard', () => {
  assert.equal(isResolutionOverdue(null, null, new Date()), false);
});
