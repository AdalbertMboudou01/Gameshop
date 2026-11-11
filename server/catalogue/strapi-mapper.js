import { isValidPrice, toCents } from '../lib/money.js';

/**
 * Conversion des articles Strapi (collection `article` : Product_name, Price, Picture)
 * vers le modèle produit de la boutique.
 *
 * @typedef {{ src: string, srcset: string, width: number|null, height: number|null, alt: string }} ProductImage
 * @typedef {{ id: string, name: string, priceCents: number, image: ProductImage|null }} Product
 */

/** Largeur sous laquelle un format Strapi n'est pas proposé dans le srcset (miniature). */
const MIN_SRCSET_WIDTH = 200;

/**
 * Les fichiers locaux de Strapi sont servis par la boutique via /media (même origine).
 * @param {string | undefined} url
 */
export function toMediaUrl(url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return url.startsWith('/uploads/') ? `/media${url}` : null;
}

/** @returns {ProductImage | null} */
function toProductImage(picture, fallbackAlt) {
  if (!picture?.url) return null;

  const candidates = Object.values(picture.formats ?? {})
    .filter((format) => format?.url && format.width > MIN_SRCSET_WIDTH)
    .map((format) => ({ url: toMediaUrl(format.url), width: format.width }));
  if (picture.width) candidates.push({ url: toMediaUrl(picture.url), width: picture.width });

  const byWidth = new Map(candidates.filter((c) => c.url).map((c) => [c.width, c]));
  const srcset = [...byWidth.values()]
    .sort((a, b) => a.width - b.width)
    .map((c) => `${c.url} ${c.width}w`)
    .join(', ');

  return {
    src: toMediaUrl(picture.formats?.small?.url ?? picture.url),
    srcset,
    width: picture.width ?? null,
    height: picture.height ?? null,
    alt: picture.alternativeText || fallbackAlt,
  };
}

/**
 * @param {any} article élément de `data` renvoyé par GET /api/articles
 * @returns {Product | null} null si l'article est incomplet (nom, prix ou identifiant manquant)
 */
export function toProduct(article) {
  const name = typeof article?.Product_name === 'string' ? article.Product_name.trim() : '';
  const priceCents = toCents(article?.Price);
  if (!article?.documentId || !name || !isValidPrice(priceCents)) return null;

  const pictures = Array.isArray(article.Picture) ? article.Picture : [];
  const picture = pictures.find((p) => p?.mime?.startsWith('image/')) ?? pictures[0];
  return { id: article.documentId, name, priceCents, image: toProductImage(picture, name) };
}
