/**
 * Erreur applicative portant un statut HTTP, un code stable (lu par le front),
 * un message affichable au client et, si besoin, le champ de formulaire concerné.
 */
export class AppError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {{ cause?: unknown, field?: string }} [options]
   */
  constructor(status, code, message, { cause, field } = {}) {
    super(message, { cause });
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

/** @typedef {{ field?: string }} ErrorOptions */
export const badRequest = (code, message, options) => new AppError(400, code, message, options);
export const unauthorized = (code, message) => new AppError(401, code, message);
export const forbidden = (code, message) => new AppError(403, code, message);
export const notFound = (code, message) => new AppError(404, code, message);
export const conflict = (code, message, options) => new AppError(409, code, message, options);
export const unsupportedMediaType = (code, message) => new AppError(415, code, message);
export const tooManyRequests = (code, message) => new AppError(429, code, message);

/** Le catalogue Strapi ne répond pas : message générique côté client, détail technique pour les logs. */
export class CatalogueUnavailableError extends AppError {
  /** @param {string} detail @param {{ cause?: unknown, upstreamStatus?: number }} [options] */
  constructor(detail, { cause, upstreamStatus } = {}) {
    super(503, 'CATALOGUE_UNAVAILABLE',
      'Le catalogue est momentanément indisponible. Réessayez dans quelques instants.', { cause });
    this.name = 'CatalogueUnavailableError';
    this.detail = detail;
    this.upstreamStatus = upstreamStatus;
  }
}
