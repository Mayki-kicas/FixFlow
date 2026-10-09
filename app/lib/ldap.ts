import { Client } from 'ldapts';
import { UserRole } from '@prisma/client';

export interface LDAPUser {
  uid: string;
  dn: string;
  email: string;
  displayName: string;
  memberOf?: string[];
}

class LDAPService {
  private mkAttemptId() {
    return `ldap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private maskDN(dn?: string) {
    if (!dn) return 'undefined';
    return dn.replace(/(^[^=]+=)[^,]+/i, '$1***');
  }

  private createClient() {
    return new Client({
      url: process.env.LDAP_URL || 'ldap://localhost:389',
      timeout: 5000,
      connectTimeout: 10000,
      tlsOptions: {
        rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false',
      },
    });
  }

  private escapeLDAPFilter(value: string) {
    return value.replace(/[\0\(\)\*\\]/g, (char) => {
      switch (char) {
        case '\\':
          return '\\5c';
        case '*':
          return '\\2a';
        case '(':
          return '\\28';
        case ')':
          return '\\29';
        case '\0':
          return '\\00';
        default:
          return char;
      }
    });
  }

  private firstString(value: unknown): string | undefined {
    if (typeof value === 'string') {
      const v = value.trim();
      return v.length > 0 ? v : undefined;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          const v = item.trim();
          if (v.length > 0) return v;
        }
      }
    }
    return undefined;
  }

  private stringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      return [value];
    }
    return [];
  }

  private parseInteger(value: unknown): number | null {
    const raw = this.firstString(value);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private isArchivedOrDisabled(entry: Record<string, unknown>) {
    const accountStatus = this.firstString(entry.accountStatus)?.toLowerCase();
    if (accountStatus && ['inactive', 'disabled', 'archived', 'deleted', 'locked'].some((word) => accountStatus.includes(word))) {
      return true;
    }

    const nsAccountLock = this.firstString(entry.nsAccountLock)?.toLowerCase();
    if (nsAccountLock === 'true') {
      return true;
    }

    const pwdAccountLockedTime = this.firstString(entry.pwdAccountLockedTime);
    if (pwdAccountLockedTime) {
      return true;
    }

    const userAccountControl = this.parseInteger(entry.userAccountControl);
    if (userAccountControl !== null && (userAccountControl & 2) === 2) {
      return true;
    }

    return false;
  }

  async listActiveUsers(): Promise<LDAPUser[]> {
    const attemptId = this.mkAttemptId();
    const client = this.createClient();
    const ldapUrl = process.env.LDAP_URL || 'ldap://localhost:389';
    const searchBase = process.env.LDAP_SEARCH_BASE || '';
    const maxResults = Number.parseInt(process.env.LDAP_IMPORT_LIMIT || '1000', 10);
    const listFilter = process.env.LDAP_USER_LIST_FILTER || '(&(objectClass=person)(!(objectClass=computer)))';

    console.error(`[${attemptId}] LDAP list users start`, {
      ldapUrl,
      searchBase,
      filter: listFilter,
      maxResults,
      bindDn: this.maskDN(process.env.LDAP_BIND_DN),
    });

    try {
      await client.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!);

      const searchResult = await client.search(process.env.LDAP_SEARCH_BASE!, {
        filter: listFilter,
        scope: 'sub',
        sizeLimit: Number.isFinite(maxResults) ? maxResults : 1000,
        attributes: [
          'uid',
          'sAMAccountName',
          'mail',
          'userPrincipalName',
          'displayName',
          'cn',
          'memberOf',
          'accountStatus',
          'nsAccountLock',
          'pwdAccountLockedTime',
          'userAccountControl',
        ],
      });

      const seenDns = new Set<string>();
      const users: LDAPUser[] = [];

      for (const entry of searchResult.searchEntries || []) {
        if (!entry?.dn || seenDns.has(entry.dn)) {
          continue;
        }

        if (this.isArchivedOrDisabled(entry as Record<string, unknown>)) {
          continue;
        }

        const uid =
          this.firstString(entry.uid) ||
          this.firstString(entry.sAMAccountName) ||
          this.firstString(entry.cn) ||
          entry.dn;

        const email =
          this.firstString(entry.mail) ||
          this.firstString(entry.userPrincipalName) ||
          `${uid}@local`;

        const displayName =
          this.firstString(entry.displayName) ||
          this.firstString(entry.cn) ||
          uid;

        users.push({
          uid,
          dn: entry.dn,
          email,
          displayName,
          memberOf: this.stringArray(entry.memberOf),
        });

        seenDns.add(entry.dn);
      }

      users.sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }));

      console.error(`[${attemptId}] LDAP list users success`, { count: users.length });

      return users;
    } catch (error) {
      console.error(`[${attemptId}] LDAP list users error`, error);
      return [];
    } finally {
      await client.unbind().catch(() => {});
    }
  }

  async authenticate(username: string, password: string): Promise<LDAPUser | null> {
    const attemptId = this.mkAttemptId();
    const client = this.createClient();
    const trimmedUsername = username.trim();
    const ldapUrl = process.env.LDAP_URL || 'ldap://localhost:389';
    const searchBase = process.env.LDAP_SEARCH_BASE || '';

    console.error(`[${attemptId}] LDAP auth start`, {
      username: trimmedUsername,
      passwordLength: password?.length ?? 0,
      ldapUrl,
      searchBase,
      tlsRejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false',
      bindDn: this.maskDN(process.env.LDAP_BIND_DN),
    });

    try {
      // Bind avec les credentials admin pour chercher l'utilisateur
      console.error(`[${attemptId}] LDAP admin bind attempt`);
      await client.bind(
        process.env.LDAP_BIND_DN!,
        process.env.LDAP_BIND_PASSWORD!
      );
      console.error(`[${attemptId}] LDAP admin bind success`);

      const escapedUsername = this.escapeLDAPFilter(trimmedUsername);
      const usernameAttribute = process.env.LDAP_USERNAME_ATTRIBUTE || 'uid';
      const localPart = escapedUsername.includes('@')
        ? escapedUsername.split('@')[0]
        : escapedUsername;
      const searchFilter = `(|(${usernameAttribute}=${escapedUsername})(sAMAccountName=${escapedUsername})(mail=${escapedUsername})(userPrincipalName=${escapedUsername})(cn=${escapedUsername})(sAMAccountName=${localPart}))`;

      console.error(`[${attemptId}] LDAP search`, {
        filter: searchFilter,
        usernameAttribute,
      });

      // Chercher l'utilisateur
      const searchResult = await client.search(process.env.LDAP_SEARCH_BASE!, {
        filter: searchFilter,
        scope: 'sub',
        attributes: ['uid', 'sAMAccountName', 'mail', 'userPrincipalName', 'displayName', 'cn', 'memberOf'],
      });

      console.error(`[${attemptId}] LDAP search done`, {
        count: searchResult.searchEntries?.length ?? 0,
      });

      if (!searchResult.searchEntries || searchResult.searchEntries.length === 0) {
        console.error(`[${attemptId}] LDAP user not found`, {
          username: trimmedUsername,
          filter: searchFilter,
        });
        return null;
      }

      const entry = searchResult.searchEntries[0];
      const userDN = entry.dn;
      console.error(`[${attemptId}] LDAP user found`, {
        userDn: userDN,
        uid: entry.uid,
        sAMAccountName: entry.sAMAccountName,
        mail: entry.mail,
        userPrincipalName: entry.userPrincipalName,
      });

      // Tester l'authentification de l'utilisateur
      console.error(`[${attemptId}] LDAP user bind attempt`, { userDn: userDN });
      await client.bind(userDN, password);
      console.error(`[${attemptId}] LDAP user bind success`, { userDn: userDN });

      const uid =
        this.firstString(entry.uid) ||
        this.firstString(entry.sAMAccountName) ||
        trimmedUsername.split('@')[0] ||
        trimmedUsername;
      const email =
        this.firstString(entry.mail) ||
        this.firstString(entry.userPrincipalName) ||
        `${uid}@local`;
      const displayName =
        this.firstString(entry.displayName) ||
        this.firstString(entry.cn) ||
        uid;

      // Extraire les informations
      const ldapUser: LDAPUser = {
        uid,
        dn: userDN,
        email,
        displayName,
        memberOf: this.stringArray(entry.memberOf),
      };

      console.error(`[${attemptId}] LDAP auth success`, {
        uid: ldapUser.uid,
        dn: ldapUser.dn,
        email: ldapUser.email,
        displayName: ldapUser.displayName,
        memberOfCount: ldapUser.memberOf?.length ?? 0,
      });

      return ldapUser;
    } catch (error) {
      console.error(`[${attemptId}] LDAP authentication error`, error);
      return null;
    } finally {
      console.error(`[${attemptId}] LDAP unbind`);
      await client.unbind().catch(() => {});
    }
  }

  // Mappe l'appartenance aux groupes AD (OU TicketsMaintenance) vers un rôle.
  // Renvoie null si l'utilisateur n'est dans AUCUN groupe de rôle → pas d'accès.
  determineRole(memberOf: string[] = []): UserRole | null {
    const ou = (process.env.LDAP_ROLE_OU || 'TicketsMaintenance').toLowerCase();
    const adminGroup = (process.env.LDAP_GROUP_ADMIN || 'Admin').toLowerCase();
    const managerGroup = (process.env.LDAP_GROUP_MANAGER || 'Manager').toLowerCase();
    const basicGroup = (process.env.LDAP_GROUP_BASIC || 'Basic').toLowerCase();

    const dns = memberOf.map((g) => g.toLowerCase());

    // Membre du groupe `cn=<name>` dans l'OU des rôles (bornes `,` pour éviter les
    // faux positifs type "Administrators" qui contient "admin").
    const inRoleGroup = (cn: string) =>
      dns.some((dn) => dn.includes(`cn=${cn},`) && dn.includes(`ou=${ou},`));

    // L'administrateur du domaine (Domain Admins) est admin par défaut de l'outil.
    const isDomainAdmin = dns.some(
      (dn) => dn.includes('cn=domain admins,') || dn.includes('cn=administrators,'),
    );

    if (isDomainAdmin || inRoleGroup(adminGroup)) return 'ADMIN';
    if (inRoleGroup(managerGroup)) return 'MANAGER';
    if (inRoleGroup(basicGroup)) return 'BASIC';
    return null; // aucun groupe de rôle → aucun accès
  }
}

export const ldapService = new LDAPService();
