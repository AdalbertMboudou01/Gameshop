import { randomBytes } from 'node:crypto';
import { withTransaction } from '../db/database.js';
import { badRequest, conflict, notFound } from '../lib/errors.js';

/** @typedef {import('../repositories/orders.js').Order} Order */

export const generateOrderReference = () => `GS-${randomBytes(4).toString('hex').toUpperCase()}`;

/**
 * Paiement fictif : aucune transaction, aucune donnée bancaire. La confirmation enregistre
 * la commande aux prix actuels de Strapi et vide le panier, de façon atomique et idempotente.
 *
 * @param {{
 *   db: import('node:sqlite').DatabaseSync,
 *   orders: ReturnType<typeof import('../repositories/orders.js').createOrderRepository>,
 *   cartItems: ReturnType<typeof import('../repositories/cart.js').createCartRepository>,
 *   cartService: ReturnType<typeof import('./cart-service.js').createCartService>,
 *   generateReference?: () => string,
 * }} deps
 */
export function createCheckoutService({ db, orders, cartItems, cartService, generateReference = generateOrderReference }) {
  return {
    /**
     * @param {number} customerId
     * @param {{ checkoutKey: string, expectedTotalCents?: number }} input
     * @returns {Promise<{ order: Order, created: boolean }>}
     */
    async checkout(customerId, { checkoutKey, expectedTotalCents }) {
      // Idempotence : un double clic ou un rejeu renvoie la même commande.
      const existing = orders.findByCheckoutKey(checkoutKey);
      if (existing) {
        if (existing.customerId !== customerId) {
          throw conflict('CHECKOUT_KEY_CONFLICT', 'Requête de paiement invalide.');
        }
        return { order: existing, created: false };
      }

      const cart = await cartService.getCart(customerId, { fresh: true });
      if (cart.notices.length) {
        throw conflict('CART_CHANGED', 'Votre panier a changé : vérifiez-le avant de confirmer.');
      }
      if (cart.items.length === 0) throw badRequest('EMPTY_CART', 'Votre panier est vide.');
      if (expectedTotalCents !== undefined && expectedTotalCents !== cart.totalCents) {
        throw conflict('PRICE_CHANGED', 'Les prix ont été mis à jour : vérifiez le nouveau total avant de confirmer.');
      }

      const items = cart.items.map(({ productId, name, unitPriceCents, quantity, lineTotalCents }) => ({
        productId, name, unitPriceCents, quantity, lineTotalCents,
      }));

      const order = withTransaction(db, () => {
        orders.create({
          reference: generateReference(),
          checkoutKey,
          customerId,
          totalCents: cart.totalCents,
          items,
        });
        cartItems.clear(customerId);
        return orders.findByCheckoutKey(checkoutKey);
      });
      return { order, created: true };
    },

    /** @returns {Order} */
    getOrder(customerId, reference) {
      const order = orders.findByReference(reference, customerId);
      if (!order) throw notFound('ORDER_NOT_FOUND', 'Commande introuvable.');
      return order;
    },
  };
}
