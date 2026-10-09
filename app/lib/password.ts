import { randomBytes, scrypt as _scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(_scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string) {
  const [salt, digestHex] = hash.split(':');
  if (!salt || !digestHex) return false;
  const digest = Buffer.from(digestHex, 'hex');
  const derived = (await scrypt(password, salt, digest.length)) as Buffer;
  if (derived.length !== digest.length) return false;
  return timingSafeEqual(derived, digest);
}

