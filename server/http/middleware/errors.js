import { AppError, CatalogueUnavailableError, notFound } from '../../lib/errors.js';

/** Route API inconnue. */
export function apiNotFound() {
  throw notFound('NOT_FOUND', 'Ressource introuvable.');
}

/**
 * Convertit toute erreur en réponse JSON `{ error: { code, message } }`.
 * Les détails techniques restent dans les logs, jamais dans la réponse.
 * @param {Pick<Console, 'warn' | 'error'>} logger
 */
export function createApiErrorHandler(logger) {
  // Express reconnaît un gestionnaire d'erreurs à ses 4 paramètres (d'où `_next`).
  return (error, _req, res, _next) => {
    if (error?.type === 'entity.parse.failed') {
      return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Requête invalide.' } });
    }
    if (error instanceof AppError) {
      if (error instanceof CatalogueUnavailableError) logger.warn(`[catalogue] ${error.detail}`);
      if (error.retryAfter) res.set('Retry-After', String(error.retryAfter));
      const body = { code: error.code, message: error.message };
      if (error.field) body.field = error.field;
      return res.status(error.status).json({ error: body });
    }
    logger.error(error);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Une erreur inattendue est survenue.' } });
  };
}
