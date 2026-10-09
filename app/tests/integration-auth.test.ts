import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isTimestampFresh,
  isValidCronToken,
  isValidIntegrationToken,
} from '@/lib/integration-auth';

test('isValidCronToken: comparaison Bearer sur INTERNAL_CRON_TOKEN', () => {
  process.env.INTERNAL_CRON_TOKEN = 'secret-cron-abc';
  assert.equal(isValidCronToken('Bearer secret-cron-abc'), true);
  assert.equal(isValidCronToken('Bearer wrong'), false);
  assert.equal(isValidCronToken('secret-cron-abc'), false); // sans préfixe Bearer
  assert.equal(isValidCronToken(null), false);
});

test('isValidIntegrationToken: comparaison Bearer sur INTEGRATION_SHARED_TOKEN', () => {
  process.env.INTEGRATION_SHARED_TOKEN = 'int-xyz';
  assert.equal(isValidIntegrationToken('Bearer int-xyz'), true);
  assert.equal(isValidIntegrationToken('Bearer nope'), false);
});

test('token invalide si le secret n’est pas défini', () => {
  delete process.env.INTERNAL_CRON_TOKEN;
  assert.equal(isValidCronToken('Bearer anything'), false);
});

test('isTimestampFresh: accepte récent, rejette ancien/invalide', () => {
  assert.equal(isTimestampFresh(String(Date.now())), true);
  assert.equal(isTimestampFresh(String(Date.now() - 5 * 60 * 1000)), false); // 5 min > 60s
  assert.equal(isTimestampFresh('not-a-number'), false);
  assert.equal(isTimestampFresh(null), false);
});
