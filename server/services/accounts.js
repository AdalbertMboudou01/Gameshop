import { hashPassword } from '../lib/passwords.js';

/**
 * Crée le compte s'il n'existe pas ; avec `resetPassword`, réinitialise son mot de passe.
 * @param {ReturnType<typeof import('../repositories/customers.js').createCustomerRepository>} customers
 * @param {{ email: string, password: string, name: string }} account
 * @param {{ resetPassword?: boolean }} [options]
 * @returns {Promise<'created' | 'reset' | 'unchanged'>}
 */
export async function ensureAccount(customers, { email, password, name }, { resetPassword = false } = {}) {
  if (!customers.findByEmail(email)) {
    customers.create({ email, name, passwordHash: await hashPassword(password) });
    return 'created';
  }
  if (resetPassword) {
    customers.updatePasswordHash(email, await hashPassword(password));
    return 'reset';
  }
  return 'unchanged';
}
