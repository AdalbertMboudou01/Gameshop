import { unauthorized } from '../../lib/errors.js';
import { parseCookies, serializeCookie } from '../cookies.js';

export const SESSION_COOKIE = 'gs_session';

/**
 * Lien entre le cookie de session et le service d'authentification.
 * @param {{ authService: ReturnType<typeof import('../../services/auth-service.js').createAuthService>, secure: boolean }} options
 */
export function createSessionHandling({ authService, secure }) {
  const readToken = (req) => parseCookies(req.headers.cookie)[SESSION_COOKIE];

  return {
    readToken,

    /** Middleware : renseigne `req.customer` si la session est valide. */
    loadSession(req, _res, next) {
      req.customer = authService.resolveSession(readToken(req));
      next();
    },

    /** Middleware : refuse la requête sans session valide. */
    requireAuth(req, _res, next) {
      if (!req.customer) {
        throw unauthorized('UNAUTHENTICATED', 'Votre session a expiré. Veuillez vous reconnecter.');
      }
      next();
    },

    /**
     * @param {import('express').Response} res
     * @param {string} token
     * @param {{ persistentMs?: number }} [options] durée du cookie persistant ; sans elle, cookie de session
     */
    setCookie(res, token, { persistentMs } = {}) {
      const maxAgeSeconds = persistentMs ? Math.floor(persistentMs / 1000) : undefined;
      res.append('Set-Cookie', serializeCookie(SESSION_COOKIE, token, { maxAgeSeconds, secure }));
    },

    clearCookie(res) {
      res.append('Set-Cookie', serializeCookie(SESSION_COOKIE, '', { maxAgeSeconds: 0, secure }));
    },
  };
}
