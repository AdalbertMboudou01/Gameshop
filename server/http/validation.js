import { badRequest } from '../lib/errors.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_ID_RE = /^[a-z0-9]{10,64}$/i;
const ORDER_REFERENCE_RE = /^GS-[0-9A-F]{8}$/;

/** Lecture et validation des entrées HTTP (format uniquement ; les règles métier sont dans les services). */

export const readString = (value) => (typeof value === 'string' ? value : '');

/** @returns {string} documentId Strapi */
export function readProductId(value) {
  if (typeof value !== 'string' || !PRODUCT_ID_RE.test(value)) {
    throw badRequest('INVALID_PRODUCT', 'Article invalide.');
  }
  return value;
}

/** @returns {string} clé UUID d'idempotence du paiement */
export function readCheckoutKey(value) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw badRequest('INVALID_CHECKOUT_KEY', 'Requête de paiement invalide.');
  }
  return value;
}

/** @returns {number | undefined} entier, ou undefined si absent / non entier */
export const readOptionalInteger = (value) => (Number.isInteger(value) ? value : undefined);

/** @returns {string | null} référence de commande, ou null si le format est invalide */
export const readOrderReference = (value) => (ORDER_REFERENCE_RE.test(String(value)) ? String(value) : null);
