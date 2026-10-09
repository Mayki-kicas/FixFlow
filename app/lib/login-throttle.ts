import { prisma } from '@/lib/prisma';

const LOGIN_WINDOW_MS = Number(process.env.SECURITY_LOGIN_WINDOW_MS || 10 * 60 * 1000);
const LOGIN_MAX_ATTEMPTS = Number(process.env.SECURITY_LOGIN_MAX_ATTEMPTS || 8);

// Pure & testable : la limite est-elle respectée compte tenu des tentatives récentes ?
export function isWithinRateLimit(
  attemptTimestamps: number[],
  now: number,
  windowMs: number,
  maxAttempts: number,
): boolean {
  const recent = attemptTimestamps.filter((ts) => now - ts <= windowMs);
  return recent.length < maxAttempts;
}

// Anti-brute-force PERSISTANT (table LoginAttempt) : fiable au redémarrage et partagé entre
// instances, contrairement à un compteur en mémoire. Best-effort : en cas d'incident du store,
// on NE bloque PAS la connexion (l'accès réel reste gardé par l'auth + la DB de toute façon).
export async function isLoginAllowed(key: string): Promise<boolean> {
  try {
    const now = Date.now();
    const windowStart = new Date(now - LOGIN_WINDOW_MS);
    const rows = await prisma.loginAttempt.findMany({
      where: { key, createdAt: { gte: windowStart } },
      select: { createdAt: true },
    });
    return isWithinRateLimit(rows.map((r) => r.createdAt.getTime()), now, LOGIN_WINDOW_MS, LOGIN_MAX_ATTEMPTS);
  } catch (error) {
    console.error('[login-throttle] isLoginAllowed store error', error);
    return true; // fail-open
  }
}

export async function registerFailedLoginAttempt(key: string): Promise<void> {
  try {
    await prisma.loginAttempt.create({ data: { key } });
    // Purge best-effort des tentatives hors fenêtre pour cette clé (borne la table).
    await prisma.loginAttempt.deleteMany({
      where: { key, createdAt: { lt: new Date(Date.now() - LOGIN_WINDOW_MS) } },
    });
  } catch (error) {
    console.error('[login-throttle] registerFailedLoginAttempt store error', error);
  }
}

export async function clearLoginAttempts(key: string): Promise<void> {
  try {
    await prisma.loginAttempt.deleteMany({ where: { key } });
  } catch (error) {
    console.error('[login-throttle] clearLoginAttempts store error', error);
  }
}
