/**
 * Filtres du catalogue (recherche, tranche de prix), stockés dans l'URL :
 *   /?q=ps&prix=100-500
 * Les articles sont toujours classés par nom.
 * Module sans DOM : testable sous Node.
 *
 * @typedef {{ id: string, name: string, priceCents: number }} FilterableProduct
 * @typedef {{ q: string, prix: string | null }} CatalogueFilters
 */

/** Tranches de prix proposées dans la navigation. */
export const PRICE_RANGES = Object.freeze([
  { id: 'moins-100', label: 'Moins de 100 €', matches: (cents) => cents < 10_000 },
  { id: '100-500', label: 'De 100 à 500 €', matches: (cents) => cents >= 10_000 && cents <= 50_000 },
  { id: 'plus-500', label: 'Plus de 500 €', matches: (cents) => cents > 50_000 },
]);

const byName = (a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base', numeric: true });
const MAX_QUERY_LENGTH = 80;

/** Minuscules, sans accents ni espaces superflus. */
export const normalize = (text) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Lit les filtres depuis l'URL ; toute valeur inconnue revient à la valeur par défaut.
 * @param {URLSearchParams} params
 * @returns {CatalogueFilters}
 */
export function parseFilters(params) {
  const prix = params.get('prix');
  return {
    q: (params.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH),
    prix: PRICE_RANGES.some((range) => range.id === prix) ? prix : null,
  };
}

/**
 * Chemin du catalogue pour ces filtres (les valeurs par défaut sont omises).
 * @param {Partial<CatalogueFilters>} filters
 */
export function cataloguePath({ q = '', prix = null } = {}) {
  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (prix) params.set('prix', prix);
  const search = params.toString();
  return search ? `/?${search}` : '/';
}

/**
 * Vrai si le nom contient tous les mots recherchés (« ps 4 », « horizon »)
 * ou la recherche sans espaces (« ps5 » trouve « PS 5 custom »).
 */
export function matchesQuery(name, query) {
  const q = normalize(query);
  if (!q) return true;
  const n = normalize(name);
  return q.split(' ').every((word) => n.includes(word)) || n.replaceAll(' ', '').includes(q.replaceAll(' ', ''));
}

/**
 * Applique recherche et tranche de prix, puis classe par nom, sans modifier le tableau d'origine.
 * @template {FilterableProduct} T
 * @param {T[]} products
 * @param {CatalogueFilters} filters
 * @returns {T[]}
 */
export function applyFilters(products, { q, prix }) {
  const range = PRICE_RANGES.find((r) => r.id === prix);
  return products
    .filter((p) => matchesQuery(p.name, q) && (!range || range.matches(p.priceCents)))
    .sort(byName);
}

/** Libellé de la tranche de prix, ou null. */
export const priceRangeLabel = (id) => PRICE_RANGES.find((range) => range.id === id)?.label ?? null;
