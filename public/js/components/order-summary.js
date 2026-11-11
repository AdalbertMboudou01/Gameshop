import { h } from '../core/dom.js';
import { formatPrice, plural } from '../core/format.js';

/** Liste compacte « Nom × quantité … montant » (paiement, confirmation). */
export function orderLines(items) {
  return h('ul', { class: 'mini-lines' }, items.map((item) => h('li', { class: 'mini-line' },
    h('span', { class: 'mini-line__name' }, item.name, h('span', { class: 'mini-line__qty' }, ` × ${item.quantity}`)),
    h('span', { class: 'mini-line__price' }, formatPrice(item.lineTotalCents)),
  )));
}

/**
 * Lignes de totaux : sous-total facultatif, livraison, total mis en avant.
 * @param {{ count: number, totalCents: number, subtotalCents?: number, shippingCents?: number, totalLabel?: string, totalId?: string }} totals
 */
export function totalsRows({ count, totalCents, subtotalCents, shippingCents = 0, totalLabel = 'Total TTC', totalId }) {
  const row = (label, value, valueAttrs = {}) => h('div', { class: 'summary__row' }, h('dt', {}, label), h('dd', valueAttrs, value));
  return h('dl', { class: 'summary__rows' },
    subtotalCents !== undefined && row(`Sous-total (${plural(count, 'article')})`, formatPrice(subtotalCents)),
    row('Livraison', shippingCents ? formatPrice(shippingCents) : 'Offerte', { class: shippingCents ? null : 'is-positive' }),
    h('div', { class: 'summary__row summary__row--total' },
      h('dt', {}, totalLabel), h('dd', { id: totalId }, formatPrice(totalCents))),
  );
}
