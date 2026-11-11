// Crée le compte de démonstration ; `--reset` réinitialise son mot de passe.
import { loadConfig } from '../server/config.js';
import { openDatabase } from '../server/db/database.js';
import { createCustomerRepository } from '../server/repositories/customers.js';
import { ensureAccount } from '../server/services/accounts.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);
const { email } = config.demoAccount;

const result = await ensureAccount(createCustomerRepository(db), config.demoAccount, {
  resetPassword: process.argv.includes('--reset'),
});

const messages = {
  created: `Compte de démonstration créé : ${email}`,
  reset: `Mot de passe du compte ${email} réinitialisé.`,
  unchanged: `Compte de démonstration déjà présent : ${email}`,
};
console.log(messages[result]);
console.log(`Base SQLite : ${config.dbPath}`);
db.close();
