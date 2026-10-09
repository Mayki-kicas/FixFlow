import test from 'node:test';
import assert from 'node:assert/strict';
import type { UserRole } from '@prisma/client';
import {
  isDemandeReviewer,
  demandeReviewWhere,
  canReviewDemandeLocation,
} from '@/lib/demande-review';

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'MAINTAINER', 'BASIC'];

test('isDemandeReviewer: seuls ADMIN et MANAGER sont valideurs potentiels', () => {
  assert.equal(isDemandeReviewer('ADMIN'), true);
  assert.equal(isDemandeReviewer('MANAGER'), true);
  assert.equal(isDemandeReviewer('MAINTAINER'), false);
  assert.equal(isDemandeReviewer('BASIC'), false);
});

test('demandeReviewWhere: ADMIN voit tout (aucune restriction)', () => {
  assert.deepEqual(demandeReviewWhere('ADMIN', []), {});
  assert.deepEqual(demandeReviewWhere('ADMIN', ['loc-1']), {});
});

test('demandeReviewWhere: MANAGER = ses sites OU sans site', () => {
  assert.deepEqual(demandeReviewWhere('MANAGER', ['loc-1', 'loc-2']), {
    OR: [{ locationId: null }, { locationId: { in: ['loc-1', 'loc-2'] } }],
  });
});

test('demandeReviewWhere: non-valideur ne matche rien', () => {
  for (const role of ['MAINTAINER', 'BASIC'] as UserRole[]) {
    assert.deepEqual(demandeReviewWhere(role, ['loc-1']), { id: '__none__' });
  }
});

test('canReviewDemandeLocation: ADMIN peut toujours', () => {
  assert.equal(canReviewDemandeLocation('ADMIN', [], 'loc-1'), true);
  assert.equal(canReviewDemandeLocation('ADMIN', [], null), true);
});

test('canReviewDemandeLocation: MANAGER seulement sur ses sites', () => {
  assert.equal(canReviewDemandeLocation('MANAGER', ['loc-1'], 'loc-1'), true);
  assert.equal(canReviewDemandeLocation('MANAGER', ['loc-1'], 'loc-2'), false);
});

test('canReviewDemandeLocation: demande sans site => tout MANAGER peut trancher', () => {
  assert.equal(canReviewDemandeLocation('MANAGER', [], null), true);
});

test('canReviewDemandeLocation: non-valideur jamais', () => {
  for (const role of ['MAINTAINER', 'BASIC'] as UserRole[]) {
    assert.equal(canReviewDemandeLocation(role, ['loc-1'], 'loc-1'), false);
    assert.equal(canReviewDemandeLocation(role, [], null), false);
  }
});
