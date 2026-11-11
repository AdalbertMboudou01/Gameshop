/**
 * @typedef {{ id: number, email: string, name: string, passwordHash: string }} CustomerRecord
 * @param {import('node:sqlite').DatabaseSync} db
 */
export function createCustomerRepository(db) {
  const byEmail = db.prepare(
    'SELECT id, email, name, password_hash AS passwordHash FROM customers WHERE email = ?',
  );
  const insert = db.prepare('INSERT INTO customers (email, name, password_hash) VALUES (?, ?, ?)');
  const updateHash = db.prepare('UPDATE customers SET password_hash = ? WHERE email = ?');

  return {
    /** @returns {CustomerRecord | undefined} */
    findByEmail: (email) => byEmail.get(email),

    /** @returns {number} identifiant créé */
    create: ({ email, name, passwordHash }) => Number(insert.run(email, name, passwordHash).lastInsertRowid),

    /** @returns {boolean} vrai si un compte a été mis à jour */
    updatePasswordHash: (email, passwordHash) => updateHash.run(passwordHash, email).changes > 0,
  };
}
