import { badRequest } from '../lib/errors.js';

/**
 * Règles de création de compte (sans dépendance : testables seules).
 * Le front applique les mêmes règles pour guider la saisie (public/js/config.js).
 */
export const ACCOUNT_RULES = Object.freeze({
  nameMinLength: 2,
  nameMaxLength: 60,
  emailMaxLength: 254,
  passwordMinLength: 8,
  passwordMaxLength: 128,
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Caractères de contrôle interdits dans le nom (retours à la ligne, tabulations…).
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f]/;

export const normalizeEmail = (email) => email.trim().toLowerCase();

/**
 * Valide et normalise les données d'inscription.
 * @param {{ name: string, email: string, password: string }} input
 * @returns {{ name: string, email: string, password: string }}
 * @throws {import('../lib/errors.js').AppError} 400 avec le champ concerné (`field`)
 */
export function validateRegistration({ name, email, password }) {
  const cleanName = name.trim().replace(/\s+/g, ' ');
  const cleanEmail = normalizeEmail(email);
  const { nameMinLength, nameMaxLength, emailMaxLength, passwordMinLength, passwordMaxLength } = ACCOUNT_RULES;

  if (cleanName.length < nameMinLength || cleanName.length > nameMaxLength || CONTROL_CHARS_RE.test(cleanName)) {
    throw badRequest('INVALID_NAME',
      `Saisissez votre nom (${nameMinLength} à ${nameMaxLength} caractères).`, { field: 'name' });
  }
  if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > emailMaxLength) {
    throw badRequest('INVALID_EMAIL', 'Saisissez une adresse e-mail valide, par exemple nom@domaine.fr.', { field: 'email' });
  }
  if (password.length < passwordMinLength || password.length > passwordMaxLength
    || !/\p{L}/u.test(password) || !/\d/.test(password)) {
    throw badRequest('WEAK_PASSWORD',
      `Le mot de passe doit contenir au moins ${passwordMinLength} caractères, dont une lettre et un chiffre.`,
      { field: 'password' });
  }
  return { name: cleanName, email: cleanEmail, password };
}
