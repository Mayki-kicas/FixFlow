import test from 'node:test';
import assert from 'node:assert/strict';
import { startOfWeekUtc, addDaysUtc, ymdUtc, parseYmdUtc } from '@/lib/planning-core';

test('startOfWeekUtc: renvoie le lundi de la semaine', () => {
  // 2026-09-09 est un mercredi -> lundi 2026-09-07
  assert.equal(ymdUtc(startOfWeekUtc(new Date('2026-09-09T12:00:00Z'))), '2026-09-07');
  // un lundi reste le même jour
  assert.equal(ymdUtc(startOfWeekUtc(new Date('2026-09-07T23:00:00Z'))), '2026-09-07');
  // un dimanche -> lundi précédent
  assert.equal(ymdUtc(startOfWeekUtc(new Date('2026-09-13T01:00:00Z'))), '2026-09-07');
});

test('addDaysUtc: décale de N jours (sans muter)', () => {
  const base = new Date('2026-09-07T12:00:00Z');
  assert.equal(ymdUtc(addDaysUtc(base, 6)), '2026-09-13');
  assert.equal(ymdUtc(base), '2026-09-07'); // non muté
});

test('parseYmdUtc: valide / invalide', () => {
  assert.equal(ymdUtc(parseYmdUtc('2026-09-07')!), '2026-09-07');
  assert.equal(parseYmdUtc('2026-9-7'), null);
  assert.equal(parseYmdUtc(undefined), null);
  assert.equal(parseYmdUtc('abc'), null);
});
