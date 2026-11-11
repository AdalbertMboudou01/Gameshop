import { alertBox, errorState, loadingLine, setBusy, stateBlock } from '../components/feedback.js';
import { STEP, checkoutSteps, page, pageHeader } from '../components/layout.js';
import { orderLines, totalsRows } from '../components/order-summary.js';
import { CHECKOUT_MIN_DURATION_MS } from '../config.js';
import { api } from '../core/api.js';
import { h } from '../core/dom.js';
import { formatPrice } from '../core/format.js';
import { icon } from '../core/icons.js';
import { store } from '../core/store.js';

/** Erreurs qui signifient « le panier a changé » : on recharge le récapitulatif au lieu d'échouer. */
const CART_OUTDATED_CODES = new Set(['CART_CHANGED', 'PRICE_CHANGED', 'EMPTY_CART']);
const EMPTY_CART = Object.freeze({ items: [], count: 0, subtotalCents: 0, shippingCents: 0, totalCents: 0, notices: [] });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** UUID v4 ; crypto.randomUUID n'existe qu'en contexte sécurisé (pas sur http://192.168.x.x). */
function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const customerPanel = (customer) => h('section', { class: 'panel', 'aria-labelledby': 'customer-title' },
  h('h2', { class: 'panel__title', id: 'customer-title' }, 'Client'),
  h('p', { class: 'panel__strong' }, customer.name),
  h('p', { class: 'panel__muted' }, customer.email),
);

const paymentPanel = () => h('section', { class: 'panel', 'aria-labelledby': 'payment-title' },
  h('h2', { class: 'panel__title', id: 'payment-title' }, 'Mode de paiement'),
  h('div', { class: 'payment-option' },
    h('span', { class: 'payment-option__icon' }, icon('lock', { size: 22 })),
    h('div', {},
      h('p', { class: 'panel__strong' }, 'Paiement simulé ', h('span', { class: 'tag' }, 'Démo')),
      h('p', { class: 'panel__muted' }, 'Aucune transaction n’est effectuée et aucune donnée bancaire n’est demandée. La confirmation enregistre simplement votre commande.'),
    ),
  ),
);

const emptyCheckout = () => stateBlock({
  iconName: 'bag',
  title: 'Votre panier est vide',
  text: 'Ajoutez au moins un article avant de passer au paiement.',
  action: h('a', { class: 'button button--primary', href: '/', 'data-link': true }, 'Découvrir le catalogue'),
});

/** @type {import('../core/router.js').View} */
export async function renderCheckout(main, { navigate, isCurrent }) {
  const header = pageHeader({ title: 'Paiement', meta: 'Vérifiez votre commande puis confirmez le paiement fictif.' });
  const content = h('div', { class: 'checkout-layout' });
  main.replaceChildren(page(checkoutSteps(STEP.PAYMENT), header.element, content));

  // Clé d'idempotence : un double clic ne crée qu'une commande. Renouvelée si le panier change.
  let checkoutKey = uuid();

  async function confirm(cart, button, errorSlot) {
    errorSlot.replaceChildren();
    const restore = setBusy(button, 'Paiement en cours…');
    try {
      const [{ order }] = await Promise.all([api.checkout(checkoutKey, cart.totalCents), wait(CHECKOUT_MIN_DURATION_MS)]);
      store.setCart(EMPTY_CART);
      navigate(`/confirmation/${order.reference}`, { replace: true });
    } catch (error) {
      if (error.status === 401 || !isCurrent()) return;
      if (CART_OUTDATED_CODES.has(error.code)) {
        checkoutKey = uuid();
        await load(alertBox(error.message, { title: 'Votre commande a été mise à jour' }));
        const alert = content.querySelector('.alert');
        alert?.setAttribute('tabindex', '-1');
        alert?.focus();
        return;
      }
      restore();
      errorSlot.replaceChildren(alertBox(error.message, { title: 'Le paiement n’a pas pu être simulé' }));
    }
  }

  function draw(cart, notice) {
    store.setCart(cart);
    if (cart.items.length === 0) {
      content.replaceChildren(emptyCheckout());
      return;
    }

    const errorSlot = h('div', { class: 'checkout__alert' }, notice);
    const confirmButton = h('button', {
      type: 'button',
      class: 'button button--primary button--block button--lg',
      onclick: () => confirm(cart, confirmButton, errorSlot),
    }, icon('lock', { size: 18 }), h('span', {}, `Confirmer le paiement fictif · ${formatPrice(cart.totalCents)}`));

    content.replaceChildren(
      h('div', { class: 'checkout__main' }, errorSlot, customerPanel(store.customer), paymentPanel()),
      h('aside', { class: 'summary', 'aria-labelledby': 'order-title' },
        h('h2', { class: 'summary__title', id: 'order-title' }, 'Votre commande'),
        orderLines(cart.items),
        totalsRows({ ...cart, totalLabel: 'Total à payer' }),
        confirmButton,
        h('a', { class: 'button button--ghost button--block', href: '/panier', 'data-link': true },
          icon('arrowLeft', { size: 18 }), h('span', {}, 'Modifier le panier')),
      ),
    );
  }

  /** @param {Node} [notice] alerte affichée au-dessus du récapitulatif rechargé */
  async function load(notice) {
    content.replaceChildren(loadingLine('Préparation de votre commande…'));
    try {
      const cart = await api.cart();
      if (isCurrent()) draw(cart, notice);
    } catch (error) {
      if (error.status === 401 || !isCurrent()) return;
      content.replaceChildren(errorState({
        title: 'Impossible de préparer le paiement',
        error,
        onRetry: () => load().then(() => header.title.focus()),
      }));
    }
  }

  await load();
}
