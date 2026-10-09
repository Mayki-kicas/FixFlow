import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectiveSla } from '@/lib/equipment-sla';

const category = {
  defaultPriority: 'P2' as const,
  correctiveSlaHours: 72,
  p1DelayDays: 3,
  p2DelayDays: 7,
  p3DelayDays: null,
};

const noOverride = {
  defaultPriority: null,
  correctiveSlaHours: null,
  p1DelayDays: null,
  p2DelayDays: null,
  p3DelayDays: null,
};

test('sans surcharge : hérite entièrement de la catégorie', () => {
  assert.deepEqual(resolveEffectiveSla(noOverride, category), category);
});

test('surcharge équipement : écrase toujours la catégorie (même plus faible)', () => {
  const effective = resolveEffectiveSla(
    { ...noOverride, defaultPriority: 'P1', correctiveSlaHours: 4 },
    category,
  );
  assert.equal(effective.defaultPriority, 'P1');
  assert.equal(effective.correctiveSlaHours, 4);
  // Les champs non surchargés restent hérités.
  assert.equal(effective.p1DelayDays, 3);
  assert.equal(effective.p2DelayDays, 7);
  assert.equal(effective.p3DelayDays, null);
});

test('override pur : un équipement peut être MOINS urgent que sa catégorie', () => {
  const strongCategory = { ...category, defaultPriority: 'P1' as const, correctiveSlaHours: 1 };
  const effective = resolveEffectiveSla(
    { ...noOverride, defaultPriority: 'P3', correctiveSlaHours: 48 },
    strongCategory,
  );
  assert.equal(effective.defaultPriority, 'P3');
  assert.equal(effective.correctiveSlaHours, 48);
});

test('surcharge partielle des délais devis', () => {
  const effective = resolveEffectiveSla({ ...noOverride, p3DelayDays: 30 }, category);
  assert.equal(effective.p1DelayDays, 3);
  assert.equal(effective.p2DelayDays, 7);
  assert.equal(effective.p3DelayDays, 30);
});
