import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/** Paramètres scrypt : N=2^15, r=8, p=1 (~32 Mo par calcul). */
const PARAMS = Object.freeze({ N: 32768, r: 8, p: 1, keyLength: 64, saltLength: 16 });
const MAX_MEMORY = 64 * 1024 * 1024;
const PREFIX = 'scrypt';

const derive = (password, salt, keyLength, { N, r, p }) =>
  scryptAsync(password.normalize('NFKC'), salt, keyLength, { N, r, p, maxmem: MAX_MEMORY });

/**
 * Hache un mot de passe au format `scrypt$N$r$p$sel$hash` (base64).
 * @param {string} password
 */
export async function hashPassword(password) {
  const salt = randomBytes(PARAMS.saltLength);
  const key = await derive(password, salt, PARAMS.keyLength, PARAMS);
  return [PREFIX, PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

/**
 * Vérifie un mot de passe en temps constant.
 * @param {string} password
 * @param {string} stored
 */
export async function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await derive(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p),
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** Hachage factice comparé quand l'e-mail est inconnu, pour un temps de réponse constant. */
export const DUMMY_HASH = await hashPassword(randomBytes(12).toString('hex'));
