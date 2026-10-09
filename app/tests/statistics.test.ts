import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTrendSeries,
  calculateAverageResolutionHours,
  calculateResolutionRate,
  calculateTeamPerformance,
  detectIncidentPeaks,
} from '@/lib/statistics';

test('calculateAverageResolutionHours returns 0 on empty input', () => {
  assert.equal(calculateAverageResolutionHours([]), 0);
});

test('calculateAverageResolutionHours computes mean hours', () => {
  const tickets = [
    { openedAt: new Date('2026-02-01T08:00:00Z'), closedAt: new Date('2026-02-01T10:00:00Z') },
    { openedAt: new Date('2026-02-01T12:00:00Z'), closedAt: new Date('2026-02-01T15:00:00Z') },
  ];
  assert.equal(calculateAverageResolutionHours(tickets), 2.5);
});

test('calculateAverageResolutionHours ignore les tickets ouverts (dénominateur = clos)', () => {
  const tickets = [
    { openedAt: new Date('2026-02-01T08:00:00Z'), closedAt: new Date('2026-02-01T10:00:00Z') }, // 2h
    { openedAt: new Date('2026-02-01T12:00:00Z'), closedAt: null }, // ouvert → ignoré
  ];
  // Sans le fix : 2 / 2 = 1 ; avec le fix : 2 / 1 = 2.
  assert.equal(calculateAverageResolutionHours(tickets), 2);
});

test('calculateResolutionRate handles zero and regular cases', () => {
  assert.equal(calculateResolutionRate(0, 5), 0);
  assert.equal(calculateResolutionRate(10, 4), 40);
});

test('buildTrendSeries aggregates ticket counts by day', () => {
  const since = new Date('2026-02-01T00:00:00Z');
  const dates = [
    new Date('2026-02-01T08:00:00Z'),
    new Date('2026-02-01T10:00:00Z'),
    new Date('2026-02-03T09:00:00Z'),
  ];
  const trend = buildTrendSeries(since, 4, dates);

  assert.deepEqual(trend, [
    { dayKey: '2026-02-01', count: 2 },
    { dayKey: '2026-02-02', count: 0 },
    { dayKey: '2026-02-03', count: 1 },
    { dayKey: '2026-02-04', count: 0 },
  ]);
});

test('detectIncidentPeaks identifies outlier days', () => {
  const series = [
    { dayKey: '2026-02-01', count: 1 },
    { dayKey: '2026-02-02', count: 2 },
    { dayKey: '2026-02-03', count: 8 },
    { dayKey: '2026-02-04', count: 2 },
    { dayKey: '2026-02-05', count: 1 },
  ];
  const peaks = detectIncidentPeaks(series);

  assert.deepEqual(peaks, [{ dayKey: '2026-02-03', count: 8 }]);
});

test('calculateTeamPerformance aggregates by team', () => {
  const tickets = [
    { teamId: 'A', openedAt: new Date('2026-02-01T08:00:00Z'), closedAt: new Date('2026-02-01T10:00:00Z') },
    { teamId: 'A', openedAt: new Date('2026-02-02T08:00:00Z'), closedAt: new Date('2026-02-02T11:00:00Z') },
    { teamId: 'B', openedAt: new Date('2026-02-02T09:00:00Z'), closedAt: new Date('2026-02-02T10:00:00Z') },
  ];
  const performance = calculateTeamPerformance(tickets);

  assert.deepEqual(performance.get('A'), { totalHours: 5, count: 2 });
  assert.deepEqual(performance.get('B'), { totalHours: 1, count: 1 });
});
