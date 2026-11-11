import { createHash, randomBytes } from 'node:crypto';
import { badRequest, conflict, tooManyRequests, unauthorized } from '../lib/errors.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../lib/passwords.js';
import { ACCOUNT_RULES, normalizeEmail, validateRegistration } from './account-rules.js';

/** @typedef {{ id: number, email: string, name: string }} Customer */
/** @typedef {{ customer: Customer, token: string, ttlMs: number }} SessionResult */

const INVALID_CREDENTIALS = 'Adresse e-mail ou mot de passe incorrect.';
const EMAIL_TAKEN = 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous ou utilisez une autre adresse.';
const MAX_PASSWORD_INPUT = 256;

const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const isUniqueViolation = (error) => /UNIQUE constraint failed/i.test(String(error?.message));

/** Refuse la requête si la clé a dépassé sa limite de tentatives. */
function assertNotLimited(limiter, key) {
  const retryAfter = limiter.retryAfterSeconds(key);
  if (!retryAfter) return;
  const error = tooManyRequests('TOO_MANY_ATTEMPTS',
    `Trop de tentatives. Réessayez dans ${Math.ceil(retryAfter / 60)} minute(s).`);
  error.retryAfter = retryAfter;
  throw error;
}

/**
 * Authentification, inscription et sessions. Le jeton n'est jamais stocké en clair (empreinte SHA-256).
 *
 * @param {{
 *   customers: ReturnType<typeof import('../repositories/customers.js').createCustomerRepository>,
 *   sessions: ReturnType<typeof import('../repositories/sessions.js').createSessionRepository>,
 *   limiter: ReturnType<typeof import('../lib/rate-limiter.js').createRateLimiter>,
 *   registerLimiter: ReturnType<typeof import('../lib/rate-limiter.js').createRateLimiter>,
 *   sessionTtlMs: number,
 *   rememberTtlMs: number,
 *   now?: () => number,
 * }} deps
 */
export function createAuthService({
  customers, sessions, limiter, registerLimiter, sessionTtlMs, rememberTtlMs, now = Date.now,
}) {
  /** @returns {SessionResult} */
  function openSession(customer, remember) {
    sessions.deleteExpired(now());
    const ttlMs = remember ? rememberTtlMs : sessionTtlMs;
    const token = randomBytes(32).toString('base64url');
    sessions.create(hashToken(token), customer.id, now() + ttlMs);
    return { customer: { id: customer.id, email: customer.email, name: customer.name }, token, ttlMs };
  }

  return {
    /**
     * Vérifie les identifiants puis ouvre une session.
     * @param {{ email: string, password: string, remember?: boolean, clientId: string }} input
     *   `remember` prolonge la session ; `clientId` identifie l'appelant (IP) pour la limitation
     * @returns {Promise<SessionResult>}
     */
    async login({ email, password, remember = false, clientId }) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail || !password) {
        throw badRequest('MISSING_FIELDS', 'Renseignez votre adresse e-mail et votre mot de passe.');
      }
      if (normalizedEmail.length > ACCOUNT_RULES.emailMaxLength || password.length > MAX_PASSWORD_INPUT) {
        throw unauthorized('INVALID_CREDENTIALS', INVALID_CREDENTIALS);
      }

      const limitKey = `${clientId}|${normalizedEmail}`;
      assertNotLimited(limiter, limitKey);

      const record = customers.findByEmail(normalizedEmail);
      // Le hachage factice garde un temps de réponse identique pour un e-mail inconnu.
      const valid = await verifyPassword(password, record?.passwordHash ?? DUMMY_HASH);
      if (!record || !valid) {
        limiter.record(limitKey);
        throw unauthorized('INVALID_CREDENTIALS', INVALID_CREDENTIALS);
      }

      limiter.reset(limitKey);
      return openSession(record, remember);
    },

    /**
     * Crée un compte client (mot de passe haché) puis ouvre une session.
     * @param {{ name: string, email: string, password: string, clientId: string }} input
     * @returns {Promise<SessionResult>}
     */
    async register({ name, email, password, clientId }) {
      assertNotLimited(registerLimiter, clientId);
      registerLimiter.record(clientId);

      const account = validateRegistration({ name, email, password });
      if (customers.findByEmail(account.email)) {
        throw conflict('EMAIL_TAKEN', EMAIL_TAKEN, { field: 'email' });
      }

      const passwordHash = await hashPassword(account.password);
      let id;
      try {
        id = customers.create({ email: account.email, name: account.name, passwordHash });
      } catch (error) {
        // Deux inscriptions simultanées avec le même e-mail : la contrainte UNIQUE tranche.
        if (isUniqueViolation(error)) throw conflict('EMAIL_TAKEN', EMAIL_TAKEN, { field: 'email' });
        throw error;
      }
      return openSession({ id, email: account.email, name: account.name }, false);
    },

    /**
     * @param {string | undefined} token
     * @returns {Customer | null}
     */
    resolveSession(token) {
      if (!token) return null;
      const tokenHash = hashToken(token);
      const row = sessions.findWithCustomer(tokenHash);
      if (!row) return null;
      if (row.expiresAt <= now()) {
        sessions.delete(tokenHash);
        return null;
      }
      return { id: row.id, email: row.email, name: row.name };
    },

    /** @param {string | undefined} token */
    logout(token) {
      if (token) sessions.delete(hashToken(token));
    },
  };
}
