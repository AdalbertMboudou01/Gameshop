import { createApp } from './app.js';
import { createStrapiCatalogue } from './catalogue/strapi-catalogue.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { createCustomerRepository } from './repositories/customers.js';
import { ensureAccount } from './services/accounts.js';

const config = loadConfig();
const db = openDatabase(config.dbPath);

if (await ensureAccount(createCustomerRepository(db), config.demoAccount) === 'created') {
  console.log(`Compte de démonstration créé : ${config.demoAccount.email}`);
}

const catalogue = createStrapiCatalogue(config.strapi);
const app = createApp({ config, db, catalogue });

const server = app.listen(config.port, config.host, () => {
  const host = config.host === '0.0.0.0' ? 'localhost' : config.host;
  console.log(`GameShop prêt sur http://${host}:${config.port}`);
  console.log(`Catalogue Strapi : ${config.strapi.url}/api/articles`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
