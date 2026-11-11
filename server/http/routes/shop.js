import { Router } from 'express';
import { notFound } from '../../lib/errors.js';
import { readCheckoutKey, readOptionalInteger, readOrderReference, readProductId } from '../validation.js';

/** Commande exposée au navigateur (sans l'identifiant interne du client). */
const toPublicOrder = ({ reference, status, totalCents, items, createdAt }) =>
  ({ reference, status, totalCents, items, createdAt });

/**
 * Routes protégées : catalogue, panier, paiement fictif et commandes.
 * @param {{
 *   catalogue: import('../../catalogue/strapi-catalogue.js').Catalogue,
 *   cartService: ReturnType<typeof import('../../services/cart-service.js').createCartService>,
 *   checkoutService: ReturnType<typeof import('../../services/checkout-service.js').createCheckoutService>,
 *   requireAuth: import('express').RequestHandler,
 * }} deps
 */
export function createShopRouter({ catalogue, cartService, checkoutService, requireAuth }) {
  const router = Router();

  // --- Catalogue ---
  router.get('/catalogue', requireAuth, async (_req, res) => {
    res.json({ products: await catalogue.list() });
  });

  // --- Panier ---
  router.get('/cart', requireAuth, async (req, res) => {
    res.json(await cartService.getCart(req.customer.id));
  });

  router.post('/cart/items', requireAuth, async (req, res) => {
    const productId = readProductId(req.body?.productId);
    res.status(201).json(await cartService.addItem(req.customer.id, productId, req.body?.quantity ?? 1));
  });

  router.patch('/cart/items/:productId', requireAuth, async (req, res) => {
    const productId = readProductId(req.params.productId);
    res.json(await cartService.setQuantity(req.customer.id, productId, req.body?.quantity));
  });

  router.delete('/cart/items/:productId', requireAuth, async (req, res) => {
    const productId = readProductId(req.params.productId);
    res.json(await cartService.removeItem(req.customer.id, productId));
  });

  // --- Paiement fictif et commandes ---
  router.post('/checkout', requireAuth, async (req, res) => {
    const { order, created } = await checkoutService.checkout(req.customer.id, {
      checkoutKey: readCheckoutKey(req.body?.checkoutKey),
      expectedTotalCents: readOptionalInteger(req.body?.expectedTotalCents),
    });
    res.status(created ? 201 : 200).json({ order: toPublicOrder(order) });
  });

  router.get('/orders/:reference', requireAuth, (req, res) => {
    const reference = readOrderReference(req.params.reference);
    if (!reference) throw notFound('ORDER_NOT_FOUND', 'Commande introuvable.');
    res.json({ order: toPublicOrder(checkoutService.getOrder(req.customer.id, reference)) });
  });

  return router;
}
