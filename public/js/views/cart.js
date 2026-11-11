import { cartLine, cartLineSkeleton } from '../components/cart-line.js';
import { alertBox, announce, errorState, stateBlock, toast } from '../components/feedback.js';
import { STEP, checkoutSteps, page, pageHeader } from '../components/layout.js';
import { totalsRows } from '../components/order-summary.js';
import { api } from '../core/api.js';
import { h } from '../core/dom.js';
import { formatPrice, plural } from '../core/format.js';
import { icon } from '../core/icons.js';
import { store } from '../core/store.js';

const emptyCart = () => stateBlock({
  iconName: 'bag',
  title: 'Votre panier est vide',
  text: 'Parcourez le catalogue et ajoutez la console de votre choix : elle apparaîtra ici.',
  action: h('a', { class: 'button button--primary', href: '/', 'data-link': true },
    icon('arrowLeft', { size: 18 }), h('span', {}, 'Découvrir le catalogue')),
});

const summary = (cart) => h('aside', { class: 'summary', 'aria-labelledby': 'summary-title' },
  h('h2', { class: 'summary__title', id: 'summary-title' }, 'Récapitulatif'),
  totalsRows({ ...cart, totalId: 'cart-total' }),
  h('a', { class: 'button button--primary button--block button--lg summary__cta', href: '/paiement', 'data-link': true },
    h('span', {}, 'Passer au paiement'), icon('arrowRight', { size: 18 })),
  h('a', { class: 'button button--ghost button--block', href: '/', 'data-link': true }, 'Continuer mes achats'),
  h('p', { class: 'summary__note' }, icon('lock', { size: 16 }), 'Paiement fictif : aucune donnée bancaire ne vous sera demandée.'),
);

/** Barre de paiement collante (mobile). */
const checkoutBar = (cart) => h('div', { class: 'checkout-bar' },
  h('p', { class: 'checkout-bar__total' }, h('span', {}, 'Total TTC'), h('strong', {}, formatPrice(cart.totalCents))),
  h('a', { class: 'button button--primary', href: '/paiement', 'data-link': true }, 'Paiement'),
);

/** @type {import('../core/router.js').View} */
export async function renderCart(main, { isCurrent }) {
  const header = pageHeader({ title: 'Votre panier' });
  const content = h('div', { class: 'cart-layout' });
  main.replaceChildren(page(checkoutSteps(STEP.CART), header.element, content));

  let pending = false;
  /** @type {IntersectionObserver | null} */
  let observer = null;

  /**
   * Applique une modification puis réaffiche le panier renvoyé par le serveur (total recalculé côté serveur).
   * @param {() => Promise<any>} request
   * @param {{ focusKey?: string, removedProductId?: string, message: (cart: any) => string }} options
   */
  async function mutate(request, { focusKey, removedProductId, message }) {
    if (pending) return;
    pending = true;
    const removedIndex = removedProductId
      ? [...content.querySelectorAll('.line')].findIndex((li) => li.dataset.product === removedProductId)
      : null;
    content.querySelectorAll('.line button').forEach((button) => { button.disabled = true; });
    content.classList.add('is-updating');
    try {
      const cart = await request();
      if (!isCurrent()) return;
      draw(cart, { focusKey, removedIndex });
      if (cart.items.length === 0) header.title.focus();
      announce(message(cart));
    } catch (error) {
      if (error.status === 401 || !isCurrent()) return;
      toast(error.message, { tone: 'error' });
      await load({ focusKey });
    } finally {
      pending = false;
      content.classList.remove('is-updating');
    }
  }

  const lineHandlers = ({ productId, name }) => ({
    onQuantityChange: (quantity, focusKey) => mutate(() => api.setQuantity(productId, quantity), {
      focusKey,
      message: (cart) => `Quantité de ${name} : ${quantity}. Nouveau total : ${formatPrice(cart.totalCents)}.`,
    }),
    onRemove: () => mutate(() => api.removeFromCart(productId), {
      removedProductId: productId,
      message: (cart) => (cart.items.length
        ? `${name} a été retiré du panier. Nouveau total : ${formatPrice(cart.totalCents)}.`
        : `${name} a été retiré du panier. Votre panier est vide.`),
    }),
  });

  /** Remet le focus sur le contrôle équivalent après un nouveau rendu (ou sur la ligne suivante après un retrait). */
  function restoreFocus({ focusKey, removedIndex }) {
    let target = focusKey ? content.querySelector(`[data-focus="${focusKey}"]`) : null;
    if (target?.disabled) target = target.closest('.stepper').querySelector('button:not([disabled])');
    if (!target && removedIndex != null) {
      const removeButtons = content.querySelectorAll('.line__remove');
      target = removeButtons[Math.min(removedIndex, removeButtons.length - 1)];
    }
    target?.focus();
  }

  function draw(cart, focus = {}) {
    store.setCart(cart);
    observer?.disconnect();
    const notice = cart.notices?.length ? alertBox(cart.notices[0], { tone: 'info' }) : null;

    if (cart.items.length === 0) {
      header.meta.textContent = '';
      content.replaceChildren(...[notice, emptyCart()].filter(Boolean));
      return;
    }

    header.meta.textContent = plural(cart.count, 'article');
    const bar = checkoutBar(cart);
    const summaryEl = summary(cart);
    content.replaceChildren(
      h('section', { class: 'cart-lines', 'aria-label': 'Articles du panier' },
        notice,
        h('ul', { class: 'lines' }, cart.items.map((item) => cartLine(item, lineHandlers(item)))),
      ),
      summaryEl,
      bar,
    );

    // Sur mobile, la barre collante s'efface quand le bouton du récapitulatif est visible (pas de doublon).
    observer = new IntersectionObserver(([entry]) => bar.classList.toggle('is-hidden', entry.isIntersecting));
    observer.observe(summaryEl.querySelector('.summary__cta'));
    restoreFocus(focus);
  }

  function showSkeleton() {
    content.replaceChildren(
      h('p', { class: 'visually-hidden', role: 'status' }, 'Chargement du panier…'),
      h('div', { class: 'cart-lines', 'aria-hidden': 'true' }, cartLineSkeleton(), cartLineSkeleton()),
    );
  }

  /** @param {{ focusKey?: string }} [options] présent après une erreur : on garde l'affichage courant */
  async function load({ focusKey } = {}) {
    // Le dernier panier connu s'affiche tout de suite, puis il est rafraîchi depuis le serveur.
    if (store.cart && focusKey === undefined) draw(store.cart);
    else if (!store.cart) showSkeleton();

    try {
      const cart = await api.cart();
      if (isCurrent()) draw(cart, { focusKey });
    } catch (error) {
      if (error.status === 401 || !isCurrent()) return;
      content.replaceChildren(errorState({
        title: 'Impossible d’afficher votre panier',
        error,
        onRetry: () => load().then(() => header.title.focus()),
      }));
    }
  }

  await load();
  return () => observer?.disconnect();
}
