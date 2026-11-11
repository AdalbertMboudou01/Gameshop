import { forbidden, unsupportedMediaType } from '../../lib/errors.js';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "style-src 'self'",
  "font-src 'self'",
  "script-src 'self'",
  "connect-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/** En-têtes de sécurité appliqués à toutes les réponses. */
export function securityHeaders(_req, res, next) {
  res.set({
    'Content-Security-Policy': CONTENT_SECURITY_POLICY,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'DENY',
  });
  next();
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protection CSRF des requêtes modifiantes : corps JSON obligatoire (sauf DELETE sans corps)
 * et en-tête Origin identique à l'hôte s'il est présent. En complément du cookie SameSite=Lax.
 */
export function sameOriginJson(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const hasBody = Number(req.get('content-length') || 0) > 0 || Boolean(req.get('transfer-encoding'));
  if ((req.method !== 'DELETE' || hasBody) && !req.is('application/json')) {
    throw unsupportedMediaType('UNSUPPORTED_MEDIA_TYPE', 'Format de requête non pris en charge.');
  }
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    throw forbidden('FORBIDDEN_ORIGIN', 'Origine non autorisée.');
  }
  next();
}

/** Les réponses de l'API ne doivent pas être mises en cache. */
export function noStore(_req, res, next) {
  res.set('Cache-Control', 'no-store');
  next();
}
