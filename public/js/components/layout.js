import { h, srOnly } from '../core/dom.js';
import { icon } from '../core/icons.js';

/** Étapes du tunnel d'achat. */
export const STEP = Object.freeze({ CART: 0, PAYMENT: 1, CONFIRMATION: 2 });
const STEP_LABELS = ['Panier', 'Paiement', 'Confirmation'];

/** Indicateur d'étapes ; `current` vaut une des valeurs de STEP. */
export function checkoutSteps(current) {
  return h('nav', { class: 'steps', 'aria-label': 'Étapes de la commande' },
    h('ol', {}, STEP_LABELS.map((label, index) => {
      const status = index < current ? 'done' : index === current ? 'current' : 'todo';
      return h('li', { class: `steps__item is-${status}`, 'aria-current': status === 'current' ? 'step' : null },
        h('span', { class: 'steps__dot', 'aria-hidden': 'true' },
          status === 'done' ? icon('check', { size: 14 }) : String(index + 1)),
        h('span', { class: 'steps__label' }, label, status === 'done' && srOnly(' (terminé)')),
      );
    })),
  );
}

/**
 * En-tête de page : sur-titre facultatif, H1 focalisable, ligne d'information.
 * @returns {{ element: HTMLElement, title: HTMLElement, meta: HTMLElement }}
 */
export function pageHeader({ eyebrow, title, meta = '' }) {
  const titleEl = h('h1', { class: 'page-title', tabindex: '-1' }, title);
  const metaEl = h('p', { class: 'page-head__meta' }, meta);
  const element = h('header', { class: 'page-head' }, eyebrow && h('p', { class: 'eyebrow' }, eyebrow), titleEl, metaEl);
  return { element, title: titleEl, meta: metaEl };
}

/** Conteneur standard d'une page. */
export const page = (...children) => h('div', { class: 'container page' }, ...children);
