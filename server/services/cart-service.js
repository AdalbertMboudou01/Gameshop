import { badRequest, notFound } from '../lib/errors.js';

export const MAX_QUANTITY = 99;
const UNAVAILABLE_NOTICE = 'Un article n’est plus disponible et a été retiré de votre panier.';

/**
 * @typedef {import('../catalogue/strapi-mapper.js').ProductImage} ProductImage
 * @typedef {{ productId: string, name: string, image: ProductImage|null, unitPriceCents: number, quantity: number, lineTotalCents: number }} CartLine
 * @typedef {{ items: CartLine[], count: number, subtotalCents: number, shippingCents: number, totalCents: number, notices: string[] }} Cart
 */

/** @param {unknown} value */
export const isValidQuantity = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_QUANTITY;

/**
 * Calcule les totaux d'un panier (livraison offerte).
 * @param {CartLine[]} items
 * @param {string[]} [notices]
 * @returns {Cart}
 */
export function summarizeCart(items, notices = []) {
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const shippingCents = 0;
  return {
    items,
    count: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotalCents,
    shippingCents,
    totalCents: subtotalCents + shippingCents,
    notices,
  };
}

/**
 * Règles du panier. Les prix viennent toujours du catalogue Strapi, jamais du client.
 * @param {{
 *   cartItems: ReturnType<typeof import('../repositories/cart.js').createCartRepository>,
 *   catalogue: import('../catalogue/strapi-catalogue.js').Catalogue,
 * }} deps
 */
export function createCartService({ cartItems, catalogue }) {
  const assertQuantity = (quantity) => {
    if (!isValidQuantity(quantity)) {
      throw badRequest('INVALID_QUANTITY', `Quantité invalide (1 à ${MAX_QUANTITY}).`);
    }
  };

  /**
   * Panier valorisé aux prix actuels ; les articles dépubliés sont retirés et signalés.
   * @param {number} customerId
   * @param {{ fresh?: boolean }} [options]
   * @returns {Promise<Cart>}
   */
  async function getCart(customerId, { fresh = false } = {}) {
    const rows = cartItems.list(customerId);
    if (rows.length === 0) return summarizeCart([]);

    const products = await catalogue.byId({ fresh });
    const items = [];
    const notices = [];
    for (const { productId, quantity } of rows) {
      const product = products.get(productId);
      if (!product) {
        cartItems.remove(customerId, productId);
        notices.push(UNAVAILABLE_NOTICE);
        continue;
      }
      items.push({
        productId,
        name: product.name,
        image: product.image,
        unitPriceCents: product.priceCents,
        quantity,
        lineTotalCents: product.priceCents * quantity,
      });
    }
    return summarizeCart(items, notices);
  }

  return {
    getCart,

    async addItem(customerId, productId, quantity = 1) {
      assertQuantity(quantity);
      const product = (await catalogue.byId()).get(productId);
      if (!product) throw notFound('PRODUCT_NOT_FOUND', 'Cet article n’est plus disponible.');

      const newQuantity = cartItems.quantityOf(customerId, productId) + quantity;
      if (newQuantity > MAX_QUANTITY) {
        throw badRequest('MAX_QUANTITY', `Quantité maximale atteinte (${MAX_QUANTITY} par article).`);
      }
      cartItems.setQuantity(customerId, productId, newQuantity);
      return getCart(customerId);
    },

    async setQuantity(customerId, productId, quantity) {
      assertQuantity(quantity);
      if (!cartItems.quantityOf(customerId, productId)) {
        throw notFound('NOT_IN_CART', 'Cet article n’est pas dans votre panier.');
      }
      cartItems.setQuantity(customerId, productId, quantity);
      return getCart(customerId);
    },

    async removeItem(customerId, productId) {
      cartItems.remove(customerId, productId);
      return getCart(customerId);
    },
  };
}
