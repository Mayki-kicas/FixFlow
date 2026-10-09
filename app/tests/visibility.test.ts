import test from 'node:test';
import assert from 'node:assert/strict';
import { isVisibilityRestricted, isSubscriptionOnly, ticketVisibilityWhere } from '@/lib/visibility';

test('isVisibilityRestricted: BASIC/MAINTAINER restreints, ADMIN/MANAGER non', () => {
  assert.equal(isVisibilityRestricted('BASIC'), true);
  assert.equal(isVisibilityRestricted('MAINTAINER'), true);
  assert.equal(isVisibilityRestricted('ADMIN'), false);
  assert.equal(isVisibilityRestricted('MANAGER'), false);
});

test('isSubscriptionOnly: seul MAINTAINER (accès explicite uniquement)', () => {
  assert.equal(isSubscriptionOnly('MAINTAINER'), true);
  assert.equal(isSubscriptionOnly('BASIC'), false);
  assert.equal(isSubscriptionOnly('ADMIN'), false);
  assert.equal(isSubscriptionOnly('MANAGER'), false);
});

test('ticketVisibilityWhere: ADMIN/MANAGER sans restriction ({})', () => {
  assert.deepEqual(ticketVisibilityWhere({ id: 'u1', role: 'ADMIN' }), {});
  assert.deepEqual(ticketVisibilityWhere({ id: 'u1', role: 'MANAGER' }), {});
});

test('ticketVisibilityWhere: BASIC = abonnement OU équipe-via-groupe', () => {
  const where = ticketVisibilityWhere({ id: 'u1', role: 'BASIC' });
  const or = (where.OR ?? []) as unknown[];
  assert.equal(or.length, 2, 'BASIC doit avoir 2 branches OR');
  assert.deepEqual(or[0], { subscriptions: { some: { userId: 'u1' } } });
  assert.deepEqual(or[1], {
    team: { groups: { some: { group: { members: { some: { userId: 'u1' } } } } } },
  });
});

test('ticketVisibilityWhere: MAINTAINER = abonnement explicite uniquement', () => {
  const where = ticketVisibilityWhere({ id: 'u1', role: 'MAINTAINER' });
  assert.deepEqual(where, { subscriptions: { some: { userId: 'u1' } } });
});
