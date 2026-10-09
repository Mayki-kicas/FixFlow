import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import AzureADProvider from 'next-auth/providers/azure-ad';
import { prisma } from './prisma';
import { ldapService } from './ldap';
import { UserRole } from '@prisma/client';
import {
  clearLoginAttempts,
  isLoginAllowed,
  registerFailedLoginAttempt,
} from './login-throttle';
import { verifyPassword } from './password';
import { getAuthConfig } from './auth-config';
import { notifyAdminsOfPendingUser } from './notifications-core';
import {
  ACCESS_PENDING_MESSAGE,
  bootstrapPromotion,
  isLoginPermitted,
  parseBootstrapAdminEmails,
  resolveNewSsoUserAccess,
} from './auth-core';

const DEV_BYPASS_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'MAINTAINER', 'BASIC'];

// Claims pertinents renvoyés par Microsoft Entra (id_token).
type EntraProfile = {
  oid?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
};

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'LDAP',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
        devRole: { label: 'Dev Role', type: 'text' },
      },
      async authorize(credentials, req) {
        const forwardedFor = req?.headers?.['x-forwarded-for'];
        const remoteIpRaw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor || req?.headers?.['x-real-ip'] || 'unknown';
        const remoteIp = String(remoteIpRaw).split(',')[0].trim();
        const loginKey = `${remoteIp}:${credentials?.username || 'anonymous'}`;
        if (!(await isLoginAllowed(loginKey))) {
          throw new Error('Trop de tentatives, reessayez plus tard');
        }

        const fail = async () => {
          await registerFailedLoginAttempt(loginKey);
          return null;
        };

        const isDevBypassEnabled =
          process.env.NODE_ENV !== 'production' &&
          process.env.DEV_AUTH_BYPASS === 'true';
        const requestedDevRole = credentials?.devRole as UserRole | undefined;

        if (isDevBypassEnabled && requestedDevRole && DEV_BYPASS_ROLES.includes(requestedDevRole)) {
          const devUser = await prisma.user.findFirst({
            where: { role: requestedDevRole },
            orderBy: { createdAt: 'asc' },
          });

          if (!devUser) {
            return fail();
          }

          await clearLoginAttempts(loginKey);

          return {
            id: devUser.id,
            email: devUser.email,
            name: devUser.displayName,
            role: devUser.role,
          };
        }

        if (!credentials?.username || !credentials?.password) {
          return fail();
        }

        const bootstrapEmails = parseBootstrapAdminEmails(process.env.BOOTSTRAP_ADMIN_EMAILS);
        const username = credentials.username.trim().toLowerCase();

        // 1) Compte LOCAL (email + mot de passe) — tout rôle, toujours disponible
        //    (admin d'amorçage, mainteneurs locaux, break-glass).
        const localUser = await prisma.user.findFirst({
          where: { email: username, passwordHash: { not: null } },
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            isActive: true,
            passwordHash: true,
          },
        });

        if (localUser?.passwordHash) {
          const isValid = await verifyPassword(credentials.password, localUser.passwordHash);
          if (!isValid) return fail();

          // Promotion d'amorçage éventuelle (email ∈ BOOTSTRAP_ADMIN_EMAILS).
          const promo = bootstrapPromotion(localUser, bootstrapEmails);
          let { role, isActive } = localUser;
          if (promo) {
            role = promo.role;
            isActive = promo.isActive;
            await prisma.user.update({ where: { id: localUser.id }, data: promo });
          }

          await clearLoginAttempts(loginKey);
          if (!isLoginPermitted({ isActive })) {
            throw new Error(ACCESS_PENDING_MESSAGE);
          }
          return { id: localUser.id, email: localUser.email, name: localUser.displayName, role };
        }

        // 2) SSO : méthode active choisie au backoffice (Entra géré au Lot B).
        const authConfig = await getAuthConfig();

        if (authConfig.activeProvider === 'LDAP') {
          try {
            const ldapUser = await ldapService.authenticate(
              credentials.username,
              credentials.password
            );
            if (!ldapUser) return fail();

            const normalizedEmail = ldapUser.email.trim().toLowerCase();
            const existing =
              (await prisma.user.findUnique({ where: { ldapId: ldapUser.dn } })) ||
              (await prisma.user.findUnique({ where: { email: normalizedEmail } }));

            let user;
            if (existing) {
              // Le rôle n'est JAMAIS écrasé par les groupes : géré en base/UI.
              // Seule une promotion d'amorçage peut l'élever.
              const promo = bootstrapPromotion(existing, bootstrapEmails);
              user = await prisma.user.update({
                where: { id: existing.id },
                data: {
                  ldapId: ldapUser.dn,
                  authProvider: 'LDAP',
                  email: normalizedEmail,
                  displayName: ldapUser.displayName,
                  ...(promo ?? {}),
                },
              });
            } else {
              // Nouveau compte SSO → accès « en attente » (sauf admin d'amorçage).
              const access = resolveNewSsoUserAccess(normalizedEmail, bootstrapEmails);
              user = await prisma.user.create({
                data: {
                  ldapId: ldapUser.dn,
                  authProvider: 'LDAP',
                  email: normalizedEmail,
                  displayName: ldapUser.displayName,
                  role: access.role,
                  isActive: access.isActive,
                },
              });
              if (!access.isActive) {
                try {
                  await notifyAdminsOfPendingUser(user);
                } catch (e) {
                  console.error('[auth] notify admins (pending LDAP) failed', e);
                }
              }
            }

            await clearLoginAttempts(loginKey);
            if (!isLoginPermitted(user)) {
              throw new Error(ACCESS_PENDING_MESSAGE);
            }
            return { id: user.id, email: user.email, name: user.displayName, role: user.role };
          } catch (error) {
            if (error instanceof Error && error.message === ACCESS_PENDING_MESSAGE) {
              throw error;
            }
            console.error('[auth] authorize LDAP flow failed', {
              username: credentials.username,
              error,
            });
            return fail();
          }
        }

        // Aucune méthode SSO applicable (ex: ENTRA actif, géré au Lot B) → échec.
        return fail();
      },
    }),
  ],
  callbacks: {
    // Flux OAuth Microsoft (Entra) : on provisionne le compte en base (pending /
    // bootstrap) et on refuse la connexion tant que l'accès n'est pas accordé.
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'azure-ad') return true; // Credentials géré dans authorize()

      const claims = (profile ?? {}) as EntraProfile;
      const email = (claims.email || claims.preferred_username || user.email || '')
        .trim()
        .toLowerCase();
      const oid = claims.oid || account.providerAccountId;
      if (!email || !oid) return false;

      const bootstrapEmails = parseBootstrapAdminEmails(process.env.BOOTSTRAP_ADMIN_EMAILS);
      const existing = await prisma.user.findFirst({
        where: { OR: [{ entraId: oid }, { email }] },
      });

      let dbUser;
      if (existing) {
        const promo = bootstrapPromotion(existing, bootstrapEmails);
        dbUser = await prisma.user.update({
          where: { id: existing.id },
          data: {
            entraId: oid,
            authProvider: 'ENTRA',
            email,
            displayName: claims.name || existing.displayName,
            ...(promo ?? {}),
          },
        });
      } else {
        const access = resolveNewSsoUserAccess(email, bootstrapEmails);
        dbUser = await prisma.user.create({
          data: {
            entraId: oid,
            authProvider: 'ENTRA',
            email,
            displayName: claims.name || email,
            role: access.role,
            isActive: access.isActive,
          },
        });
        if (!access.isActive) {
          try {
            await notifyAdminsOfPendingUser(dbUser);
          } catch (e) {
            console.error('[auth] notify admins (pending Entra) failed', e);
          }
        }
      }

      // false → NextAuth redirige vers signin avec ?error=AccessDenied (→ /auth/pending).
      return isLoginPermitted(dbUser);
    },
    async jwt({ token, user, account, profile }) {
      if (user) {
        if (account?.provider === 'azure-ad') {
          // L'utilisateur OAuth n'a pas notre id/rôle : on résout depuis la base.
          const claims = (profile ?? {}) as EntraProfile;
          const oid = claims.oid || account.providerAccountId;
          const dbUser = await prisma.user.findFirst({
            where: { OR: [{ entraId: oid }, { email: (user.email || '').toLowerCase() }] },
            select: { id: true, role: true },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
          }
        } else {
          token.role = user.role;
          token.id = user.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    // Les erreurs d'auth (dont AccessDenied d'un compte en attente) repassent par
    // la page de connexion, qui route AccessDenied vers /auth/pending.
    error: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 15,
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  secret: process.env.NEXTAUTH_SECRET,
};

// Options d'auth construites par requête : la méthode SSO active (Entra) est
// ajoutée dynamiquement selon AuthConfig + secret .env. Le compte local
// (Credentials) reste toujours disponible. getServerSession peut, lui, utiliser
// authOptions (les providers ne servent pas au décodage de session).
export async function buildAuthOptions(): Promise<NextAuthOptions> {
  const cfg = await getAuthConfig();
  const providers = [...authOptions.providers];

  if (
    cfg.activeProvider === 'ENTRA' &&
    cfg.entraClientId &&
    cfg.entraTenantId &&
    process.env.ENTRA_CLIENT_SECRET
  ) {
    providers.push(
      AzureADProvider({
        clientId: cfg.entraClientId,
        clientSecret: process.env.ENTRA_CLIENT_SECRET,
        tenantId: cfg.entraTenantId,
        authorization: { params: { scope: 'openid profile email' } },
      }),
    );
  }

  return { ...authOptions, providers };
}
