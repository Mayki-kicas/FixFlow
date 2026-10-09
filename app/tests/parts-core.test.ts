import test from 'node:test';
import assert from 'node:assert/strict';
import { isLowStock } from '@/lib/parts-core';

test('isLowStock: au ou sous le seuil', () => {
  assert.equal(isLowStock(2, 5), true);
  assert.equal(isLowStock(5, 5), true); // au seuil => bas
  assert.equal(isLowStock(6, 5), false);
});

test('isLowStock: pas de seuil => jamais bas', () => {
  assert.equal(isLowStock(0, null), false);
  assert.equal(isLowStock(0, undefined), false);
});
