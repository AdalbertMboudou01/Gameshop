import { errorState, setBusy, stateBlock, toast } from '../components/feedback.js';
import { productImage } from '../components/product-image.js';
import { api } from '../core/api.js';
import { applyFilters, cataloguePath, parseFilters, priceRangeLabel } from '../core/catalogue-filters.js';
import { h, srOnly } from '../core/dom.js';
import { formatPrice, plural } from '../core/format.js';
import { icon } from '../core/icons.js';
import { store } from '../core/store.js';

const SKELETON_COUNT = 8;
const EAGER_IMAGES = 4;
const CARD_IMAGE_SIZES = '(max-width: 639px) 46vw, (max-width: 1023px) 30vw, 280px';

const skeletonGrid = () => h('ul', { class: 'grid', 'aria-hidden': 'true' },
  Array.from({ length: SKELETON_COUNT }, () => h('li', { class: 'card card--skeleton' },
    h('div', { class: 'card__inner' },
      h('div', { class: 'media card__media skeleton' }),
      h('div', { class: 'card__body' },
        h('div', { class: 'skeleton skeleton--text' }),
        h('div', { class: 'skeleton skeleton--price' }),
        h('div', { class: 'skeleton skeleton--button' }),
      ),
    ),
  )),
);

/** Titre de la page selon le filtre actif. */
function pageTitle({ q, prix }) {
  if (q) return `Résultats pour « ${q} »`;
  return priceRangeLabel(prix) ?? 'Tous les produits';
}

/** @type {import('../core/router.js').View} */
export async function renderCatalogue(main, { query, isCurrent }) {
  const filters = parseFilters(query);
  /** @type {Array<{ id: string, name: string, priceCents: number }>} */
  let allProducts = [];

  const title = h('h1', { class: 'page-title', tabindex: '-1' }, pageTitle(filters));
  const count = h('p', { class: 'catalogue__count', id: 'catalogue-count' });
  const chips = h('ul', { class: 'chips', 'aria-label': 'Filtres actifs' });
  const body = h('div', { class: 'catalogue__body' });

  main.replaceChildren(h('div', { class: 'container page catalogue' },
    h('header', { class: 'catalogue__head' },
      h('p', { class: 'eyebrow' }, 'Catalogue'),
      title,
      count,
    ),
    chips,
    body,
  ));

  // ---------- Filtres actifs ----------
  function renderChips() {
    const chip = (label, without) => h('li', {},
      h('a', { class: 'chip', href: cataloguePath({ ...filters, ...without }), 'data-link': true },
        label, icon('close', { size: 14 }), srOnly(' (retirer ce filtre)')));
    chips.replaceChildren(
      filters.q && chip(`Recherche : ${filters.q}`, { q: '' }),
      filters.prix && chip(`Prix : ${priceRangeLabel(filters.prix)}`, { prix: null }),
    );
    chips.hidden = !chips.childElementCount;
  }

  // ---------- Grille ----------
  async function addToCart(product, button) {
    const restore = setBusy(button, 'Ajout…');
    try {
      store.setCart(await api.addToCart(product.id, 1));
      toast(`${product.name} a été ajouté au panier.`, { action: { href: '/panier', label: 'Voir le panier' } });
    } catch (error) {
      if (error.status !== 401) toast(error.message, { tone: 'error' });
      if (error.code === 'PRODUCT_NOT_FOUND') load();
    } finally {
      if (button.isConnected) restore();
    }
  }

  function productCard(product, index) {
    const titleId = `product-${product.id}`;

    const addButton = h('button', {
      type: 'button',
      class: 'button button--primary button--block card__add',
      'aria-describedby': titleId,
      onclick: () => addToCart(product, addButton),
    }, icon('cart', { size: 18 }), h('span', {}, 'Ajouter', h('span', { class: 'card__add-extra' }, ' au panier')));

    return h('li', { class: 'card' },
      h('article', { class: 'card__inner', 'aria-labelledby': titleId },
        productImage(product.image, { className: 'card__media', eager: index < EAGER_IMAGES, sizes: CARD_IMAGE_SIZES }),
        h('div', { class: 'card__body' },
          h('h2', { class: 'card__title', id: titleId }, product.name),
          h('p', { class: 'card__price' }, srOnly('Prix : '), formatPrice(product.priceCents)),
          h('p', { class: 'card__meta' }, icon('truck', { size: 14 }), 'Livraison offerte'),
          h('div', { class: 'card__actions' }, addButton),
        ),
      ),
    );
  }

  function showProducts() {
    const products = applyFilters(allProducts, filters);
    count.textContent = `${plural(products.length, 'article')} · prix TTC`;

    if (allProducts.length === 0) {
      body.replaceChildren(stateBlock({
        iconName: 'gamepad',
        title: 'Aucun article pour le moment',
        text: 'Le catalogue est vide. Revenez bientôt : de nouvelles consoles arrivent régulièrement.',
        role: 'status',
      }));
      return;
    }
    if (products.length === 0) {
      body.replaceChildren(stateBlock({
        iconName: 'search',
        title: 'Aucun article ne correspond',
        text: 'Essayez un autre mot-clé ou retirez un filtre.',
        action: h('a', { class: 'button button--primary', href: '/', 'data-link': true }, 'Voir tous les produits'),
        role: 'status',
      }));
      return;
    }
    body.replaceChildren(h('ul', { class: 'grid', 'aria-labelledby': 'catalogue-count' }, products.map(productCard)));
  }

  async function load() {
    count.textContent = '';
    body.setAttribute('aria-busy', 'true');
    body.replaceChildren(h('p', { class: 'visually-hidden', role: 'status' }, 'Chargement du catalogue…'), skeletonGrid());
    try {
      const { products } = await api.catalogue();
      if (!isCurrent()) return;
      allProducts = products;
      showProducts();
    } catch (error) {
      if (!isCurrent() || error.status === 401) return;
      body.replaceChildren(errorState({
        title: 'Impossible de charger le catalogue',
        error,
        onRetry: () => load().then(() => title.focus()),
      }));
    } finally {
      body.removeAttribute('aria-busy');
    }
  }

  renderChips();
  await load();
}
