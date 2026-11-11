import { CatalogueUnavailableError } from '../lib/errors.js';
import { toProduct } from './strapi-mapper.js';

/** @typedef {import('./strapi-mapper.js').Product} Product */

const PAGE_SIZE = 100;
const MAX_PAGES = 20;

/**
 * Client du catalogue Strapi : GET /api/articles (rôle Public autorisé sur `find`).
 * Seuls les articles publiés sont renvoyés (draftAndPublish activé). Résultat mis en cache
 * quelques secondes, avec dédoublonnage des requêtes simultanées.
 *
 * @param {{ url: string, token?: string, timeoutMs: number, cacheTtlMs: number, fetch?: typeof fetch, now?: () => number }} options
 */
export function createStrapiCatalogue({ url, token = '', timeoutMs, cacheTtlMs, fetch: fetchImpl = fetch, now = Date.now }) {
  /** @type {{ at: number, products: Product[] | null }} */
  let cache = { at: 0, products: null };
  /** @type {Promise<Product[]> | null} */
  let pending = null;

  async function fetchPage(page) {
    const endpoint = new URL('/api/articles', url);
    endpoint.searchParams.set('populate', 'Picture');
    endpoint.searchParams.set('sort', 'Product_name:asc');
    endpoint.searchParams.set('pagination[page]', String(page));
    endpoint.searchParams.set('pagination[pageSize]', String(PAGE_SIZE));

    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let response;
    try {
      response = await fetchImpl(endpoint, { headers, signal: AbortSignal.timeout(timeoutMs) });
    } catch (cause) {
      throw new CatalogueUnavailableError(`Strapi injoignable (${url}).`, { cause });
    }
    if (!response.ok) {
      throw new CatalogueUnavailableError(`Strapi a répondu ${response.status} sur /api/articles.`, {
        upstreamStatus: response.status,
      });
    }
    try {
      return await response.json();
    } catch (cause) {
      throw new CatalogueUnavailableError('Réponse Strapi illisible.', { cause });
    }
  }

  async function fetchAll() {
    const products = [];
    for (let page = 1, pageCount = 1; page <= pageCount && page <= MAX_PAGES; page += 1) {
      const body = await fetchPage(page);
      for (const article of body?.data ?? []) {
        const product = toProduct(article);
        if (product) products.push(product);
      }
      pageCount = body?.meta?.pagination?.pageCount ?? 1;
    }
    return products;
  }

  /**
   * @param {{ fresh?: boolean }} [options] `fresh` ignore le cache (ex. avant un paiement)
   * @returns {Promise<Product[]>}
   */
  async function list({ fresh = false } = {}) {
    if (!fresh && cache.products && now() - cache.at < cacheTtlMs) return cache.products;
    pending ??= fetchAll()
      .then((products) => {
        cache = { at: now(), products };
        return products;
      })
      .finally(() => {
        pending = null;
      });
    return pending;
  }

  return {
    list,
    /** @returns {Promise<Map<string, Product>>} */
    async byId(options) {
      return new Map((await list(options)).map((product) => [product.id, product]));
    },
    clearCache() {
      cache = { at: 0, products: null };
    },
  };
}

/** @typedef {ReturnType<typeof createStrapiCatalogue>} Catalogue */
