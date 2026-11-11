/** @param {string} [header] valeur de l'en-tête Cookie */
export function parseCookies(header = '') {
  /** @type {Record<string, string>} */
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 1) continue;
    try {
      cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Cookie mal encodé : ignoré.
    }
  }
  return cookies;
}

/**
 * @param {string} name
 * @param {string} value
 * @param {{ maxAgeSeconds?: number, secure?: boolean }} options sans `maxAgeSeconds` : cookie de session (effacé à la fermeture du navigateur)
 */
export function serializeCookie(name, value, { maxAgeSeconds, secure = false }) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    maxAgeSeconds !== undefined && `Max-Age=${maxAgeSeconds}`,
    secure && 'Secure',
  ].filter(Boolean).join('; ');
}
