import { PRICE_RANGES, cataloguePath, parseFilters } from '../core/catalogue-filters.js';
import { h, srOnly } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { store } from '../core/store.js';

const brand = () => h('a', { class: 'brand', href: '/', 'data-link': true, 'aria-label': 'GameShop — tous les produits' },
  h('span', { class: 'brand__mark', 'aria-hidden': 'true' }, icon('gamepad', { size: 20 })),
  h('span', { class: 'brand__name' }, 'Game', h('span', { class: 'brand__accent' }, 'Shop')),
);

const cartLabel = (count) => (count ? `Panier, ${count} article${count > 1 ? 's' : ''}` : 'Panier, vide');

/** Bandeau de réassurance (informations exactes : livraison offerte, paiement simulé, catalogue Strapi). */
const topStripContent = () => h('div', { class: 'container top-strip__inner' },
  h('p', {}, icon('truck', { size: 16 }), 'Livraison offerte sur toute la boutique'),
  h('p', {}, icon('lock', { size: 16 }), 'Paiement 100 % simulé, aucune donnée bancaire'),
  h('p', {}, icon('refresh', { size: 16 }), 'Catalogue mis à jour en direct'),
);

/**
 * En-tête du site : bandeau, barre principale (logo, recherche, compte, panier) et navigation du catalogue.
 * Hors connexion, seul le logo est affiché. Le badge du panier suit le store.
 *
 * @param {{ strip: HTMLElement, header: HTMLElement, nav: HTMLElement }} containers
 * @param {{ onLogout: () => void, onSearch: (query: string) => void }} handlers
 */
export function createHeader({ strip, header, nav }, { onLogout, onSearch }) {
  let badge = null;
  let cartLink = null;
  let lastCount = 0;

  function updateBadge() {
    if (!badge) return;
    const count = store.cart?.count ?? 0;
    if (count > lastCount) {
      badge.classList.remove('is-bumped');
      void badge.offsetWidth; // relance l'animation CSS
      badge.classList.add('is-bumped');
    }
    lastCount = count;
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.hidden = count === 0;
    cartLink.setAttribute('aria-label', cartLabel(count));
  }
  store.subscribe(updateBadge);

  function searchForm(query) {
    const input = h('input', {
      id: 'site-search', type: 'search', name: 'q', class: 'search__input', value: query,
      placeholder: 'Rechercher une console, un jeu…', autocomplete: 'off', enterkeyhint: 'search', maxlength: '80',
    });
    return h('form', {
      class: 'search', role: 'search',
      onsubmit: (event) => {
        event.preventDefault();
        onSearch(input.value.trim());
      },
    },
      h('label', { for: 'site-search', class: 'visually-hidden' }, 'Rechercher un produit'),
      icon('search', { size: 20 }),
      input,
      h('button', { type: 'submit', class: 'search__button' },
        icon('search', { size: 18 }), h('span', { class: 'search__button-label' }, 'Rechercher')),
    );
  }

  /** Navigation : tous les produits puis tranches de prix (seules données disponibles dans Strapi). */
  function navLinks(url) {
    const onCatalogue = url.pathname === '/';
    const { q, prix } = parseFilters(url.searchParams);
    const active = onCatalogue ? (prix ?? (q ? null : 'all')) : null;
    const link = (id, label, href) => h('li', {},
      h('a', { class: 'site-nav__link', href, 'data-link': true, 'aria-current': active === id ? 'page' : null }, label));

    return h('div', { class: 'container site-nav__inner' },
      h('ul', { class: 'site-nav__list' },
        link('all', 'Tous les produits', '/'),
        PRICE_RANGES.map((range) => link(range.id, range.label, cataloguePath({ prix: range.id }))),
      ),
    );
  }

  /**
   * @param {string | undefined} activeNav entrée courante (« panier »…)
   * @param {URL} url adresse courante (filtres du catalogue)
   */
  function render(activeNav, url) {
    const customer = store.customer;
    strip.hidden = nav.hidden = !customer;
    if (!customer) {
      badge = cartLink = null;
      strip.replaceChildren();
      nav.replaceChildren();
      header.replaceChildren(h('div', { class: 'container header__main header__main--minimal' }, brand()));
      return;
    }

    badge = h('span', { class: 'badge', 'aria-hidden': 'true' });
    cartLink = h('a', {
      class: 'cart-link', href: '/panier', 'data-link': true, 'aria-current': activeNav === 'panier' ? 'page' : null,
    }, icon('cart', { size: 22 }), h('span', { class: 'cart-link__label' }, 'Panier'), badge);

    const query = url.pathname === '/' ? parseFilters(url.searchParams).q : '';
    strip.replaceChildren(topStripContent());
    header.replaceChildren(h('div', { class: 'container header__main' },
      brand(),
      searchForm(query),
      h('div', { class: 'header__actions' },
        h('p', { class: 'header__user' }, icon('user', { size: 20 }),
          h('span', {}, srOnly('Connecté : '), 'Bonjour, ', h('strong', {}, customer.name.split(' ')[0]))),
        h('button', { type: 'button', class: 'icon-button', title: 'Se déconnecter', onclick: onLogout },
          icon('logout', { size: 20 }), srOnly('Se déconnecter')),
        cartLink,
      ),
    ));
    nav.replaceChildren(navLinks(url));
    updateBadge();
  }

  return { render };
}
