import { MAX_QUANTITY } from '../config.js';
import { h, srOnly } from '../core/dom.js';
import { formatPrice } from '../core/format.js';
import { icon } from '../core/icons.js';
import { productImage } from './product-image.js';

/** Clés `data-focus` des contrôles d'une ligne, pour restaurer le focus après un nouveau rendu. */
export const focusKeys = (productId) => ({
  decrease: `dec-${productId}`,
  increase: `inc-${productId}`,
  remove: `rm-${productId}`,
});

/**
 * Ligne du panier : visuel, prix unitaire, sélecteur de quantité, sous-total, bouton « Retirer ».
 * @param {{ productId: string, name: string, image: object|null, unitPriceCents: number, quantity: number, lineTotalCents: number }} item
 * @param {{ onQuantityChange: (quantity: number, focusKey: string) => void, onRemove: () => void }} handlers
 */
export function cartLine(item, { onQuantityChange, onRemove }) {
  const { productId, name, quantity } = item;
  const keys = focusKeys(productId);

  const stepButton = (direction) => {
    const isIncrease = direction === 'increase';
    const next = quantity + (isIncrease ? 1 : -1);
    return h('button', {
      type: 'button',
      class: 'stepper__button',
      'data-focus': keys[direction],
      'aria-label': `${isIncrease ? 'Augmenter' : 'Diminuer'} la quantité de ${name}`,
      disabled: isIncrease ? quantity >= MAX_QUANTITY : quantity <= 1,
      onclick: () => onQuantityChange(next, keys[direction]),
    }, icon(isIncrease ? 'plus' : 'minus', { size: 18 }));
  };

  return h('li', { class: 'line', 'data-product': productId },
    productImage(item.image, { className: 'line__media', sizes: '96px' }),
    h('div', { class: 'line__info' },
      h('h2', { class: 'line__title' }, name),
      h('p', { class: 'line__unit' }, `${formatPrice(item.unitPriceCents)} l’unité`),
      h('button', {
        type: 'button', class: 'line__remove', 'data-focus': keys.remove,
        'aria-label': `Retirer ${name} du panier`, onclick: onRemove,
      }, icon('trash', { size: 18 }), h('span', { 'aria-hidden': 'true' }, 'Retirer')),
    ),
    h('div', { class: 'line__controls' },
      h('div', { class: 'stepper', role: 'group', 'aria-label': `Quantité de ${name}` },
        stepButton('decrease'),
        h('output', { class: 'stepper__value', 'aria-label': `Quantité : ${quantity}` }, String(quantity)),
        stepButton('increase'),
      ),
      h('p', { class: 'line__total' }, srOnly('Sous-total : '), formatPrice(item.lineTotalCents)),
    ),
  );
}

/** Squelette de chargement d'une ligne. */
export const cartLineSkeleton = () => h('div', { class: 'line line--skeleton' },
  h('div', { class: 'media line__media skeleton' }),
  h('div', { class: 'line__info' }, h('div', { class: 'skeleton skeleton--text' }), h('div', { class: 'skeleton skeleton--price' })),
);
