import test from 'node:test';
import assert from 'node:assert/strict';
import {
  meanTimeToRepairHours,
  meanTimeBetweenFailuresHours,
  preventiveCompliance,
  availabilityEstimate,
} from '@/lib/reliability-core';

const d = (iso: string) => new Date(iso);

test('MTTR: moyenne des durées clôture-ouverture (OT clos)', () => {
  const r = meanTimeToRepairHours([
    { openedAt: d('2026-09-01T08:00:00Z'), closedAt: d('2026-09-01T12:00:00Z') }, // 4 h
    { openedAt: d('2026-09-02T08:00:00Z'), closedAt: d('2026-09-02T10:00:00Z') }, // 2 h
    { openedAt: d('2026-09-03T08:00:00Z'), closedAt: null }, // ignoré
  ]);
  assert.equal(r, 3); // (4+2)/2
});

test('MTTR: null si aucun OT clos', () => {
  assert.equal(meanTimeToRepairHours([{ openedAt: d('2026-09-01T08:00:00Z'), closedAt: null }]), null);
});

test('MTBF: moyenne des écarts entre ouvertures (>= 2 pannes)', () => {
  const r = meanTimeBetweenFailuresHours([
    d('2026-09-01T00:00:00Z'),
    d('2026-09-03T00:00:00Z'), // +48 h
    d('2026-09-04T00:00:00Z'), // +24 h
  ]);
  assert.equal(r, 36); // (48+24)/2
});

test('MTBF: null si moins de 2 pannes', () => {
  assert.equal(meanTimeBetweenFailuresHours([d('2026-09-01T00:00:00Z')]), null);
});

test('preventiveCompliance: ratio clos à temps', () => {
  const r = preventiveCompliance([
    { closedAt: d('2026-09-01T00:00:00Z'), dueDate: d('2026-09-02T00:00:00Z') }, // à temps
    { closedAt: d('2026-09-05T00:00:00Z'), dueDate: d('2026-09-02T00:00:00Z') }, // en retard
    { closedAt: null, dueDate: d('2026-09-02T00:00:00Z') }, // non clos => pas à temps
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.onTime, 1);
  assert.equal(r.rate, 1 / 3);
});

test('availabilityEstimate: 1 - immobilisation/période', () => {
  const period = 100 * 3_600_000; // 100 h
  const r = availabilityEstimate(
    [{ openedAt: d('2026-09-01T00:00:00Z'), closedAt: d('2026-09-01T10:00:00Z') }], // 10 h
    period,
  );
  assert.equal(r, 0.9);
});

test('availabilityEstimate: bornée à [0,1]', () => {
  const period = 5 * 3_600_000;
  const r = availabilityEstimate(
    [{ openedAt: d('2026-09-01T00:00:00Z'), closedAt: d('2026-09-01T10:00:00Z') }], // 10 h > période
    period,
  );
  assert.equal(r, 0);
});
