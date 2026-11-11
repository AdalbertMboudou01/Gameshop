import { Router } from 'express';
import { readString } from '../validation.js';

/** Données client exposées au navigateur (jamais l'identifiant interne ni le hachage). */
const toPublicCustomer = ({ email, name }) => ({ email, name });

/**
 * Connexion, inscription, déconnexion, session courante.
 * @param {{
 *   authService: ReturnType<typeof import('../../services/auth-service.js').createAuthService>,
 *   session: ReturnType<typeof import('../middleware/session.js').createSessionHandling>,
 * }} deps
 */
export function createAuthRouter({ authService, session }) {
  const router = Router();

  router.post('/login', async (req, res) => {
    const remember = req.body?.remember === true;
    const { customer, token, ttlMs } = await authService.login({
      email: readString(req.body?.email),
      password: readString(req.body?.password),
      remember,
      clientId: req.ip,
    });
    session.setCookie(res, token, { persistentMs: remember ? ttlMs : undefined });
    res.json({ customer: toPublicCustomer(customer) });
  });

  router.post('/register', async (req, res) => {
    const { customer, token } = await authService.register({
      name: readString(req.body?.name),
      email: readString(req.body?.email),
      password: readString(req.body?.password),
      clientId: req.ip,
    });
    session.setCookie(res, token);
    res.status(201).json({ customer: toPublicCustomer(customer) });
  });

  router.post('/logout', (req, res) => {
    authService.logout(session.readToken(req));
    session.clearCookie(res);
    res.json({ ok: true });
  });

  router.get('/me', (req, res) => {
    res.json({ customer: req.customer ? toPublicCustomer(req.customer) : null });
  });

  return router;
}
