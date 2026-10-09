import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { ldapService } from './ldap';
import { UserRole } from '@prisma/client';
import {
  clearLoginAttempts,
  isLoginAllowed,
  registerFailedLoginAttempt,
} from './login-throttle';
import { verifyPassword } from './password';

const DEV_BYPASS_ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'MAINTAINER', 'BASIC'];

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

        const username = credentials.username.trim().toLowerCase();
        const localMaintainerUser = await prisma.user.findFirst({
          where: {
            email: username,
            role: 'MAINTAINER',
            passwordHash: { not: null },
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            passwordHash: true,
          },
        });

        if (localMaintainerUser?.passwordHash) {
          const isValid = await verifyPassword(credentials.password, localMaintainerUser.passwordHash);
          if (!isValid) return fail();
          await clearLoginAttempts(loginKey);
          return {
            id: localMaintainerUser.id,
            email: localMaintainerUser.email,
            name: localMaintainerUser.displayName,
            role: localMaintainerUser.role,
          };
        }

        try {
          // Authentifier via LDAP
          const ldapUser = await ldapService.authenticate(
            credentials.username,
            credentials.password
          );

          if (!ldapUser) {
            return fail();
          }

          // Déterminer le rôle depuis les groupes LDAP.
          // Aucun groupe de rôle (Admin/Manager/Basic) → pas d'accès à l'outil.
          const role = ldapService.determineRole(ldapUser.memberOf);
          if (!role) {
            console.warn('[auth] LDAP user without a role group, access denied', {
              dn: ldapUser.dn,
            });
            return fail();
          }
          const normalizedEmail = ldapUser.email.trim().toLowerCase();

          // Créer ou mettre à jour l'utilisateur dans la base
          let user;
          try {
            user = await prisma.user.upsert({
              where: { ldapId: ldapUser.dn },
              create: {
                ldapId: ldapUser.dn,
                email: normalizedEmail,
                displayName: ldapUser.displayName,
                role: role,
              },
              update: {
                email: normalizedEmail,
                displayName: ldapUser.displayName,
                role: role,
              },
            });
          } catch (error) {
            // Collision email existant -> rattacher l'entrée existante au DN LDAP
            if (
              typeof error === 'object' &&
              error !== null &&
              'code' in error &&
              (error as { code?: string }).code === 'P2002'
            ) {
              const existingByEmail = await prisma.user.findUnique({
                where: { email: normalizedEmail },
                select: { id: true, role: true },
              });

              if (!existingByEmail) {
                throw error;
              }

              user = await prisma.user.update({
                where: { id: existingByEmail.id },
                data: {
                  ldapId: ldapUser.dn,
                  displayName: ldapUser.displayName,
                  role,
                },
              });
            } else {
              throw error;
            }
          }

          await clearLoginAttempts(loginKey);

          return {
            id: user.id,
            email: user.email,
            name: user.displayName,
            role: user.role,
          };
        } catch (error) {
          console.error('[auth] authorize LDAP flow failed', {
            username: credentials.username,
            error,
          });
          return fail();
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
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
  },
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 8,
    updateAge: 60 * 15,
  },
  useSecureCookies: process.env.NODE_ENV === 'production',
  secret: process.env.NEXTAUTH_SECRET,
};
