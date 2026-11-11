import { Router } from 'express';

/**
 * Configuration publique lue par le front (évite de dupliquer les identifiants de démo côté client).
 * @param {{ demoAccount: { email: string, password: string, visible: boolean } }} options
 */
export function createPublicConfigRouter({ demoAccount }) {
  const router = Router();
  const body = {
    demoAccount: demoAccount.visible ? { email: demoAccount.email, password: demoAccount.password } : null,
  };
  router.get('/', (_req, res) => res.json(body));
  return router;
}
