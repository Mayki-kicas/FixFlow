import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBootstrapAdminEmails,
  isBootstrapAdmin,
  resolveNewSsoUserAccess,
  bootstrapPromotion,
  isLoginPermitted,
  removesLastActiveAdmin,
} from '@/lib/auth-core';

test('parseBootstrapAdminEmails: split, trim, lowercase, drop empties', () => {
  assert.deepEqual(parseBootstrapAdminEmails(' A@x.com , b@x.com ,, '), ['a@x.com', 'b@x.com']);
  assert.deepEqual(parseBootstrapAdminEmails(''), []);
  assert.deepEqual(parseBootstrapAdminEmails(undefined), []);
});

test('isBootstrapAdmin: case-insensitive membership', () => {
  const list = ['boss@x.com'];
  assert.equal(isBootstrapAdmin('BOSS@x.com', list), true);
  assert.equal(isBootstrapAdmin('other@x.com', list), false);
});

test('resolveNewSsoUserAccess: bootstrap => active ADMIN, sinon pending BASIC', () => {
  assert.deepEqual(resolveNewSsoUserAccess('boss@x.com', ['boss@x.com']), { role: 'ADMIN', isActive: true });
  assert.deepEqual(resolveNewSsoUserAccess('joe@x.com', ['boss@x.com']), { role: 'BASIC', isActive: false });
});

test('bootstrapPromotion: promeut un compte existant non-admin listé, sinon null', () => {
  assert.deepEqual(
    bootstrapPromotion({ email: 'boss@x.com', role: 'BASIC', isActive: false }, ['boss@x.com']),
    { role: 'ADMIN', isActive: true },
  );
  // déjà ADMIN actif => rien à faire
  assert.equal(
    bootstrapPromotion({ email: 'boss@x.com', role: 'ADMIN', isActive: true }, ['boss@x.com']),
    null,
  );
  // non listé => rien
  assert.equal(
    bootstrapPromotion({ email: 'joe@x.com', role: 'BASIC', isActive: false }, ['boss@x.com']),
    null,
  );
});

test('isLoginPermitted: seulement les comptes actifs', () => {
  assert.equal(isLoginPermitted({ isActive: true }), true);
  assert.equal(isLoginPermitted({ isActive: false }), false);
});

test('removesLastActiveAdmin: bloque le retrait du dernier admin actif', () => {
  const admin = { role: 'ADMIN' as const, isActive: true };
  // rétrograder le dernier admin actif
  assert.equal(removesLastActiveAdmin(admin, 'MANAGER', true, 1), true);
  // désactiver le dernier admin actif
  assert.equal(removesLastActiveAdmin(admin, 'ADMIN', false, 1), true);
  // s'il reste d'autres admins actifs => autorisé
  assert.equal(removesLastActiveAdmin(admin, 'MANAGER', true, 2), false);
  // la cible n'était pas admin actif => jamais bloquant
  assert.equal(removesLastActiveAdmin({ role: 'BASIC', isActive: true }, 'ADMIN', true, 1), false);
  // reste admin actif après changement => autorisé
  assert.equal(removesLastActiveAdmin(admin, 'ADMIN', true, 1), false);
});
