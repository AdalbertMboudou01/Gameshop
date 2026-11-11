/**
 * @typedef {{ productId: string, quantity: number }} CartRow
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createCartRepository(db) {
  const list = db.prepare(
    'SELECT product_id AS productId, quantity FROM cart_items WHERE customer_id = ? ORDER BY added_at, rowid',
  );
  const quantity = db.prepare('SELECT quantity FROM cart_items WHERE customer_id = ? AND product_id = ?');
  const upsert = db.prepare(`
    INSERT INTO cart_items (customer_id, product_id, quantity) VALUES (?, ?, ?)
    ON CONFLICT (customer_id, product_id) DO UPDATE SET quantity = excluded.quantity`);
  const remove = db.prepare('DELETE FROM cart_items WHERE customer_id = ? AND product_id = ?');
  const clear = db.prepare('DELETE FROM cart_items WHERE customer_id = ?');

  return {
    /** @returns {CartRow[]} */
    list: (customerId) => list.all(customerId),
    /** @returns {number} quantité actuelle, 0 si l'article n'est pas dans le panier */
    quantityOf: (customerId, productId) => quantity.get(customerId, productId)?.quantity ?? 0,
    setQuantity: (customerId, productId, qty) => upsert.run(customerId, productId, qty),
    remove: (customerId, productId) => remove.run(customerId, productId),
    clear: (customerId) => clear.run(customerId),
  };
}
