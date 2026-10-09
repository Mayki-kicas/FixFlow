import test from 'node:test';
import assert from 'node:assert/strict';

// Config déterministe (défauts) avant import.
process.env.LDAP_ROLE_OU = 'TicketsMaintenance';
process.env.LDAP_GROUP_ADMIN = 'Admin';
process.env.LDAP_GROUP_MANAGER = 'Manager';
process.env.LDAP_GROUP_BASIC = 'Basic';

const { ldapService } = await import('../lib/ldap');
const dn = (cn: string, ou = 'TicketsMaintenance') =>
  `CN=${cn},OU=${ou},OU=Applications Groups,DC=example,DC=com`;

test('determineRole: groupes Admin/Manager/Basic de l\'OU → rôle', () => {
  assert.equal(ldapService.determineRole([dn('Admin')]), 'ADMIN');
  assert.equal(ldapService.determineRole([dn('Manager')]), 'MANAGER');
  assert.equal(ldapService.determineRole([dn('Basic')]), 'BASIC');
});

test('determineRole: priorité Admin > Manager > Basic', () => {
  assert.equal(ldapService.determineRole([dn('Basic'), dn('Manager'), dn('Admin')]), 'ADMIN');
  assert.equal(ldapService.determineRole([dn('Basic'), dn('Manager')]), 'MANAGER');
});

test('determineRole: Domain Admins → ADMIN par défaut', () => {
  assert.equal(
    ldapService.determineRole(['CN=Domain Admins,CN=Users,DC=example,DC=com']),
    'ADMIN',
  );
});

test('determineRole: aucun groupe de rôle → null (pas d\'accès)', () => {
  assert.equal(ldapService.determineRole([]), null);
  assert.equal(ldapService.determineRole(['CN=AccesSites,OU=Applications Groups,DC=example,DC=com']), null);
});

test('determineRole: bornes de nom — "AdminTools"/"Administrators-role" ≠ groupe Admin', () => {
  // Un groupe dont le CN contient "admin" mais n'est pas exactement "Admin" ne donne pas ADMIN.
  assert.equal(ldapService.determineRole([dn('AdminTools')]), null);
  // Mais un vrai groupe Basic reste BASIC même si un autre groupe ressemble à admin.
  assert.equal(ldapService.determineRole([dn('AdminTools'), dn('Basic')]), 'BASIC');
});

test('determineRole: un groupe Admin dans une AUTRE OU ne donne pas ADMIN', () => {
  assert.equal(ldapService.determineRole([dn('Admin', 'AutreOU')]), null);
});
