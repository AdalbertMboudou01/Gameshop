/** Accès à l'API de la boutique (même origine, cookie de session httpOnly). */

export class ApiError extends Error {
  /**
   * @param {number} status
   * @param {string} code
   * @param {string} message
   * @param {string} [field] champ de formulaire concerné (erreurs de validation)
   */
  constructor(status, code, message, field) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

const listeners = new Set();
/** Abonnement aux sessions expirées (401 sur une route protégée). */
export const onUnauthorized = (fn) => listeners.add(fn);

async function request(method, url, body) {
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.');
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* réponse vide ou non JSON */
  }

  if (!response.ok) {
    const error = new ApiError(
      response.status,
      data?.error?.code || 'HTTP_ERROR',
      data?.error?.message || 'Une erreur inattendue est survenue.',
      data?.error?.field,
    );
    if (response.status === 401 && error.code === 'UNAUTHENTICATED') listeners.forEach((fn) => fn(error));
    throw error;
  }
  return data;
}

export const api = {
  publicConfig: () => request('GET', '/api/config'),
  me: () => request('GET', '/api/auth/me'),
  login: (email, password, remember = false) => request('POST', '/api/auth/login', { email, password, remember }),
  register: (name, email, password) => request('POST', '/api/auth/register', { name, email, password }),
  logout: () => request('POST', '/api/auth/logout', {}),
  catalogue: () => request('GET', '/api/catalogue'),
  cart: () => request('GET', '/api/cart'),
  addToCart: (productId, quantity = 1) => request('POST', '/api/cart/items', { productId, quantity }),
  setQuantity: (productId, quantity) => request('PATCH', `/api/cart/items/${encodeURIComponent(productId)}`, { quantity }),
  removeFromCart: (productId) => request('DELETE', `/api/cart/items/${encodeURIComponent(productId)}`),
  checkout: (checkoutKey, expectedTotalCents) => request('POST', '/api/checkout', { checkoutKey, expectedTotalCents }),
  order: (reference) => request('GET', `/api/orders/${encodeURIComponent(reference)}`),
};
