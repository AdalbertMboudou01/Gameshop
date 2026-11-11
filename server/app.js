import path from 'node:path';
import express from 'express';
import { createRateLimiter } from './lib/rate-limiter.js';
import { createCartRepository } from './repositories/cart.js';
import { createCustomerRepository } from './repositories/customers.js';
import { createOrderRepository } from './repositories/orders.js';
import { createSessionRepository } from './repositories/sessions.js';
import { createAuthService } from './services/auth-service.js';
import { createCartService } from './services/cart-service.js';
import { createCheckoutService } from './services/checkout-service.js';
import { apiNotFound, createApiErrorHandler } from './http/middleware/errors.js';
import { noStore, sameOriginJson, securityHeaders } from './http/middleware/security.js';
import { createSessionHandling } from './http/middleware/session.js';
import { createAuthRouter } from './http/routes/auth.js';
import { createMediaRouter } from './http/routes/media.js';
import { createPublicConfigRouter } from './http/routes/public-config.js';
import { createShopRouter } from './http/routes/shop.js';

/** Chemins servis par l'application monopage (routage côté client). */
const SPA_ROUTES = ['/', '/connexion', '/inscription', '/panier', '/paiement', '/confirmation/:reference'];

/**
 * Assemble l'application : repositories → services → routes HTTP.
 * Toutes les dépendances sont injectées, ce qui permet de tester avec une base en mémoire et un faux catalogue.
 *
 * @param {{
 *   config: import('./config.js').Config,
 *   db: import('node:sqlite').DatabaseSync,
 *   catalogue: import('./catalogue/strapi-catalogue.js').Catalogue,
 *   logger?: Pick<Console, 'warn' | 'error'>,
 * }} deps
 */
export function createApp({ config, db, catalogue, logger = console }) {
  // Données
  const customers = createCustomerRepository(db);
  const sessions = createSessionRepository(db);
  const cartItems = createCartRepository(db);
  const orders = createOrderRepository(db);

  // Métier
  const authService = createAuthService({
    customers,
    sessions,
    limiter: createRateLimiter(config.loginRateLimit),
    registerLimiter: createRateLimiter(config.registerRateLimit),
    sessionTtlMs: config.session.ttlMs,
    rememberTtlMs: config.session.rememberTtlMs,
  });
  const cartService = createCartService({ cartItems, catalogue });
  const checkoutService = createCheckoutService({ db, orders, cartItems, cartService });

  // HTTP
  const session = createSessionHandling({ authService, secure: config.session.secureCookie });

  const api = express.Router();
  api.use(express.json({ limit: '10kb' }), noStore, sameOriginJson, session.loadSession);
  api.use('/config', createPublicConfigRouter({ demoAccount: config.demoAccount }));
  api.use('/auth', createAuthRouter({ authService, session }));
  api.use(createShopRouter({ catalogue, cartService, checkoutService, requireAuth: session.requireAuth }));
  api.use(apiNotFound);
  api.use(createApiErrorHandler(logger));

  const app = express();
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use('/vendor/inter', express.static(config.fontDir, { maxAge: '30d', immutable: true }));
  app.use(express.static(config.publicDir, { index: false }));
  app.use('/media', createMediaRouter({ strapiUrl: config.strapi.url, timeoutMs: config.strapi.timeoutMs }));
  app.use('/api', api);

  const indexHtml = path.join(config.publicDir, 'index.html');
  app.get(SPA_ROUTES, (_req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
  app.use((_req, res) => res.status(404).sendFile(indexHtml));

  return app;
}
