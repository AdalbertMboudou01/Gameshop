/** @param {import('node:sqlite').DatabaseSync} db */
export function createSessionRepository(db) {
  const insert = db.prepare('INSERT INTO sessions (token_hash, customer_id, expires_at) VALUES (?, ?, ?)');
  const find = db.prepare(`
    SELECT c.id, c.email, c.name, s.expires_at AS expiresAt
    FROM sessions s JOIN customers c ON c.id = s.customer_id
    WHERE s.token_hash = ?`);
  const remove = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const purge = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

  return {
    create: (tokenHash, customerId, expiresAt) => insert.run(tokenHash, customerId, expiresAt),
    /** @returns {{ id: number, email: string, name: string, expiresAt: number } | undefined} */
    findWithCustomer: (tokenHash) => find.get(tokenHash),
    delete: (tokenHash) => remove.run(tokenHash),
    deleteExpired: (now) => purge.run(now),
  };
}
