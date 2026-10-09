import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '@/lib/password';

test('hashPassword/verifyPassword: aller-retour', async () => {
  const hash = await hashPassword('s3cret!Pass');
  assert.match(hash, /^[0-9a-f]+:[0-9a-f]+$/);
  assert.equal(await verifyPassword('s3cret!Pass', hash), true);
  assert.equal(await verifyPassword('mauvais', hash), false);
});

test('hashPassword: deux hachages du même mot de passe diffèrent (sel aléatoire)', async () => {
  const a = await hashPassword('même');
  const b = await hashPassword('même');
  assert.notEqual(a, b);
  assert.equal(await verifyPassword('même', a), true);
  assert.equal(await verifyPassword('même', b), true);
});

test('verifyPassword: false sur hash malformé', async () => {
  assert.equal(await verifyPassword('x', 'pas-un-hash-valide'), false);
  assert.equal(await verifyPassword('x', ''), false);
});
