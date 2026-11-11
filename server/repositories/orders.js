/**
 * @typedef {{ productId: string, name: string, unitPriceCents: number, quantity: number, lineTotalCents: number }} OrderItem
 * @typedef {{ reference: string, customerId: number, status: string, totalCents: number, items: OrderItem[], createdAt: string }} Order
 */

/** @returns {Order | undefined} */
const toOrder = (row) => row && {
  reference: row.reference,
  customerId: row.customer_id,
  status: row.status,
  totalCents: row.total_cents,
  items: JSON.parse(row.items_json),
  createdAt: row.created_at,
};

/** @param {import('node:sqlite').DatabaseSync} db */
export function createOrderRepository(db) {
  const byKey = db.prepare('SELECT * FROM orders WHERE checkout_key = ?');
  const byReference = db.prepare('SELECT * FROM orders WHERE reference = ? AND customer_id = ?');
  const insert = db.prepare(`
    INSERT INTO orders (reference, checkout_key, customer_id, total_cents, items_json)
    VALUES (?, ?, ?, ?, ?)`);

  return {
    findByCheckoutKey: (checkoutKey) => toOrder(byKey.get(checkoutKey)),
    findByReference: (reference, customerId) => toOrder(byReference.get(reference, customerId)),
    /** @param {{ reference: string, checkoutKey: string, customerId: number, totalCents: number, items: OrderItem[] }} order */
    create: ({ reference, checkoutKey, customerId, totalCents, items }) =>
      insert.run(reference, checkoutKey, customerId, totalCents, JSON.stringify(items)),
  };
}
