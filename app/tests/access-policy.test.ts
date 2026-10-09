import test from 'node:test';
import assert from 'node:assert/strict';
import type { UserRole } from '@prisma/client';
import {
  canDeclareTicket,
  canManageTicketLifecycle,
  canBelongToGroup,
  canChangeTicketPriority,
  canDecideQuote,
  canReviewDemande,
} from '@/lib/access-policy';
import { isVisibilityRestricted, isSubscriptionOnly } from '@/lib/visibility';

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'MAINTAINER', 'BASIC'];

// Matrice de référence : ce que chaque rôle a le droit de faire.
// Toute régression sur une règle d'accès fait échouer un cas ici.
const MATRIX: Record<
  UserRole,
  {
    declareTicket: boolean;
    manageLifecycle: boolean;
    belongToGroup: boolean;
    visibilityRestricted: boolean;
    subscriptionOnly: boolean;
  }
> = {
  ADMIN: { declareTicket: true, manageLifecycle: true, belongToGroup: true, visibilityRestricted: false, subscriptionOnly: false },
  MANAGER: { declareTicket: true, manageLifecycle: true, belongToGroup: true, visibilityRestricted: false, subscriptionOnly: false },
  BASIC: { declareTicket: true, manageLifecycle: false, belongToGroup: true, visibilityRestricted: true, subscriptionOnly: false },
  MAINTAINER: { declareTicket: false, manageLifecycle: false, belongToGroup: false, visibilityRestricted: true, subscriptionOnly: true },
};

for (const role of ROLES) {
  test(`matrice d'accès — ${role}`, () => {
    const expected = MATRIX[role];
    assert.equal(canDeclareTicket(role), expected.declareTicket, 'canDeclareTicket');
    assert.equal(canManageTicketLifecycle(role), expected.manageLifecycle, 'canManageTicketLifecycle');
    assert.equal(canBelongToGroup(role), expected.belongToGroup, 'canBelongToGroup');
    assert.equal(isVisibilityRestricted(role), expected.visibilityRestricted, 'isVisibilityRestricted');
    assert.equal(isSubscriptionOnly(role), expected.subscriptionOnly, 'isSubscriptionOnly');
  });
}

test('invariants métier MAINTAINER (technicien extérieur)', () => {
  // Le mainteneur ne déclare pas, ne gère pas le cycle de vie, ne rejoint pas de
  // groupe, et n'a d'accès QUE par abonnement explicite.
  assert.equal(canDeclareTicket('MAINTAINER'), false);
  assert.equal(canManageTicketLifecycle('MAINTAINER'), false);
  assert.equal(canBelongToGroup('MAINTAINER'), false);
  assert.equal(isSubscriptionOnly('MAINTAINER'), true);
});

test('seuls ADMIN/MANAGER gèrent le cycle de vie et voient tout', () => {
  const full = ROLES.filter((r) => canManageTicketLifecycle(r));
  assert.deepEqual(full.sort(), ['ADMIN', 'MANAGER']);
  const unrestricted = ROLES.filter((r) => !isVisibilityRestricted(r));
  assert.deepEqual(unrestricted.sort(), ['ADMIN', 'MANAGER']);
});

test('canChangeTicketPriority: ADMIN/MANAGER seulement (chaque changement historisé)', () => {
  assert.equal(canChangeTicketPriority('ADMIN'), true);
  assert.equal(canChangeTicketPriority('MANAGER'), true);
  assert.equal(canChangeTicketPriority('BASIC'), false);
  assert.equal(canChangeTicketPriority('MAINTAINER'), false);
});

test('canDecideQuote: ADMIN/MANAGER seulement (accepter/refuser un devis)', () => {
  assert.equal(canDecideQuote('ADMIN'), true);
  assert.equal(canDecideQuote('MANAGER'), true);
  assert.equal(canDecideQuote('BASIC'), false);
  assert.equal(canDecideQuote('MAINTAINER'), false);
});

test('canReviewDemande: ADMIN/MANAGER valident/rejettent ; BASIC declare mais ne valide pas', () => {
  assert.equal(canReviewDemande('ADMIN'), true);
  assert.equal(canReviewDemande('MANAGER'), true);
  assert.equal(canReviewDemande('BASIC'), false);
  assert.equal(canReviewDemande('MAINTAINER'), false);
  // BASIC peut declarer (creer une demande) mais pas la valider.
  assert.equal(canDeclareTicket('BASIC'), true);
});
