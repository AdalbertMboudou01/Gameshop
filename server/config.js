import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const toInt = (value, fallback, name) => {
  if (value == null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`Variable ${name} invalide : « ${value} »`);
  return parsed;
};

const toBool = (value, fallback) => (value == null || value === '' ? fallback : value === 'true');

/**
 * Construit la configuration à partir des variables d'environnement (fonction pure, testable).
 * @param {NodeJS.ProcessEnv} [env]
 */
export function loadConfig(env = process.env) {
  const port = toInt(env.PORT, 3000, 'PORT');
  if (port > 65535) throw new Error(`Variable PORT invalide : « ${env.PORT} »`);

  const strapiUrl = (env.STRAPI_URL || 'http://localhost:1337').replace(/\/+$/, '');
  if (!URL.canParse(strapiUrl)) throw new Error(`Variable STRAPI_URL invalide : « ${strapiUrl} »`);

  return Object.freeze({
    host: env.HOST || '127.0.0.1',
    port,
    publicDir: path.join(ROOT_DIR, 'public'),
    fontDir: path.join(ROOT_DIR, 'node_modules/@fontsource-variable/inter'),
    dbPath: env.DB_PATH === ':memory:' ? ':memory:' : path.resolve(ROOT_DIR, env.DB_PATH || 'data/gameshop.db'),

    strapi: Object.freeze({
      /** URL de base du serveur Strapi (sans /api). */
      url: strapiUrl,
      /** Jeton d'API facultatif (si le rôle Public n'a pas accès à article.find). */
      token: env.STRAPI_API_TOKEN || '',
      timeoutMs: toInt(env.STRAPI_TIMEOUT_MS, 6000, 'STRAPI_TIMEOUT_MS'),
      cacheTtlMs: toInt(env.CATALOGUE_CACHE_MS, 10_000, 'CATALOGUE_CACHE_MS'),
    }),

    session: Object.freeze({
      /** Session standard : cookie effacé à la fermeture du navigateur, expirée côté serveur après ce délai. */
      ttlMs: toInt(env.SESSION_TTL_HOURS, 12, 'SESSION_TTL_HOURS') * 3600 * 1000,
      /** « Se souvenir de moi » : cookie persistant. */
      rememberTtlMs: toInt(env.SESSION_REMEMBER_DAYS, 30, 'SESSION_REMEMBER_DAYS') * 24 * 3600 * 1000,
      secureCookie: toBool(env.COOKIE_SECURE, false),
    }),

    loginRateLimit: Object.freeze({ max: 8, windowMs: 10 * 60 * 1000 }),
    /** Inscriptions par adresse IP. */
    registerRateLimit: Object.freeze({
      max: toInt(env.REGISTER_MAX_PER_HOUR, 10, 'REGISTER_MAX_PER_HOUR'),
      windowMs: 60 * 60 * 1000,
    }),

    demoAccount: Object.freeze({
      email: env.DEMO_EMAIL || 'demo@gameshop.test',
      password: env.DEMO_PASSWORD || 'Console2026!',
      name: env.DEMO_NAME || 'Alex Martin',
      /** Affiche les identifiants sur l'écran de connexion. */
      visible: toBool(env.SHOW_DEMO_ACCOUNT, true),
    }),
  });
}

/** @typedef {ReturnType<typeof loadConfig>} Config */
