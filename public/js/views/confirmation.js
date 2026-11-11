import { loadingLine, stateBlock } from '../components/feedback.js';
import { STEP, checkoutSteps } from '../components/layout.js';
import { orderLines, totalsRows } from '../components/order-summary.js';
import { api } from '../core/api.js';
import { h } from '../core/dom.js';
import { formatDate, plural } from '../core/format.js';
import { icon } from '../core/icons.js';

const backToCatalogue = (className) => h('a', { class: className, href: '/', 'data-link': true },
  icon('arrowLeft', { size: 18 }), h('span', {}, 'Retour au catalogue'));

function receipt(order) {
  const count = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const meta = (label, value, valueClass) => h('div', {}, h('dt', {}, label), h('dd', { class: valueClass }, value));

  return [
    h('section', { class: 'confirmation__hero', 'aria-labelledby': 'confirmation-title' },
      h('div', { class: 'confirmation__icon' }, icon('checkCircle', { size: 40 })),
      h('h1', { class: 'page-title', id: 'confirmation-title', tabindex: '-1' }, 'Paiement confirmé'),
      h('p', { class: 'confirmation__lead' },
        'Merci ! Votre commande est enregistrée. ',
        h('strong', {}, 'Il s’agit d’un paiement fictif : aucun montant n’a été débité.')),
    ),
    h('section', { class: 'panel receipt', 'aria-labelledby': 'receipt-title' },
      h('h2', { class: 'visually-hidden', id: 'receipt-title' }, 'Détail de la commande'),
      h('dl', { class: 'receipt__meta' },
        meta('Référence', order.reference, 'receipt__ref'),
        meta('Date', formatDate(order.createdAt)),
        meta('Statut', h('span', { class: 'tag tag--success' }, 'Paiement simulé accepté')),
      ),
      orderLines(order.items),
      totalsRows({ count, totalCents: order.totalCents, totalLabel: `Total (${plural(count, 'article')})` }),
    ),
    h('div', { class: 'confirmation__actions' }, backToCatalogue('button button--primary button--lg')),
  ];
}

/** @type {import('../core/router.js').View} */
export async function renderConfirmation(main, { params: [reference], isCurrent }) {
  const content = h('div', { class: 'confirmation' }, loadingLine('Chargement de votre commande…'));
  main.replaceChildren(h('div', { class: 'container page page--narrow' }, checkoutSteps(STEP.CONFIRMATION), content));

  try {
    const { order } = await api.order(reference);
    if (isCurrent()) content.replaceChildren(...receipt(order));
  } catch (error) {
    if (error.status === 401 || !isCurrent()) return;
    const missing = error.status === 404;
    content.replaceChildren(stateBlock({
      tone: 'error',
      iconName: 'alert',
      headingLevel: 'h1',
      title: missing ? 'Commande introuvable' : 'Impossible d’afficher la commande',
      text: missing ? `Aucune commande ${reference} n’est associée à votre compte.` : error.message,
      action: backToCatalogue('button button--secondary'),
    }));
  }
}
