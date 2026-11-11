// Tests d'intégration de l'API : application complète, base SQLite en mémoire, Strapi simulé.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { createApp } from '../../server/app.js';
import { createStrapiCatalogue } from '../../server/catalogue/strapi-catalogue.js';
import { loadConfig } from '../../server/config.js';
import { openDatabase } from '../../server/db/database.js';
import { verifyPassword } from '../../server/lib/passwords.js';
import { createCustomerRepository } from '../../server/repositories/customers.js';
import { ensureAccount } from '../../server/services/accounts.js';

const ACCOUNT = { email: 'test@gameshop.test', password: 'Secret123!', name: 'Test User' };
const A = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const B = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const articles = [
  { documentId: A, Product_name: 'Console A', Price: 499.99, Picture: [] },
  { documentId: B, Product_name: 'Console B', Price: 0.1, Picture: [] },
];

/** Faux `fetch` répondant comme GET /api/articles de Strapi. */
const fakeStrapiFetch = async () => Response.json({
  data: articles,
  meta: { pagination: { page: 1, pageCount: 1, total: articles.length } },
});

let server;
let base;
let customersRepo;

before(async () => {
  const config = loadConfig({ DB_PATH: ':memory:', SHOW_DEMO_ACCOUNT: 'false' });
  const db = openDatabase(config.dbPath);
  customersRepo = createCustomerRepository(db);
  await ensureAccount(customersRepo, ACCOUNT);
  const catalogue = createStrapiCatalogue({ ...config.strapi, fetch: fakeStrapiFetch });
  const silent = { warn() {}, error() {} };

  server = createApp({ config, db, catalogue, logger: silent }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server?.close());

/** Client HTTP minimal qui conserve le cookie de session. */
function client() {
  let cookie = '';
  return async (method, path, body) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

async function loggedIn() {
  const call = client();
  const res = await call('POST', '/api/auth/login', { email: ACCOUNT.email, password: ACCOUNT.password });
  assert.equal(res.status, 200);
  return call;
}

describe('authentification', () => {
  test('refuse un mauvais mot de passe avec un message générique', async () => {
    const call = client();
    const wrong = await call('POST', '/api/auth/login', { email: ACCOUNT.email, password: 'faux' });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error.code, 'INVALID_CREDENTIALS');
    const unknown = await call('POST', '/api/auth/login', { email: 'inconnu@x.fr', password: 'faux' });
    assert.equal(unknown.body.error.message, wrong.body.error.message, 'ne révèle pas si le compte existe');
  });

  test('accepte l’e-mail quelle que soit la casse et n’expose pas l’identifiant interne', async () => {
    const res = await client()('POST', '/api/auth/login', { email: 'TEST@gameshop.test', password: ACCOUNT.password });
    assert.deepEqual(res.body, { customer: { email: ACCOUNT.email, name: ACCOUNT.name } });
  });

  test('protège les routes de la boutique et distingue les routes inconnues', async () => {
    const call = client();
    assert.equal((await call('GET', '/api/catalogue')).status, 401);
    assert.equal((await call('GET', '/api/inexistant')).status, 404);
  });

  test('« Se souvenir de moi » : cookie persistant, sinon cookie de session', async () => {
    const login = (remember) => fetch(`${base}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ACCOUNT.email, password: ACCOUNT.password, remember }),
    });
    assert.match((await login(true)).headers.get('set-cookie'), /Max-Age=2592000/);
    assert.doesNotMatch((await login(false)).headers.get('set-cookie'), /Max-Age/);
  });

  test('déconnexion : la session n’est plus valide', async () => {
    const call = await loggedIn();
    await call('POST', '/api/auth/logout', {});
    assert.equal((await call('GET', '/api/cart')).status, 401);
  });

  test('masque le compte de démonstration si SHOW_DEMO_ACCOUNT=false', async () => {
    assert.deepEqual((await client()('GET', '/api/config')).body, { demoAccount: null });
  });
});

describe('inscription', () => {
  const NEW = { name: 'Léa Dupont', email: 'Lea@Exemple.fr', password: 'Manette2026' };

  test('crée le compte, connecte le client et stocke un mot de passe haché', async () => {
    const call = client();
    const res = await call('POST', '/api/auth/register', NEW);
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { customer: { email: 'lea@exemple.fr', name: 'Léa Dupont' } });
    assert.equal((await call('GET', '/api/cart')).status, 200, 'session ouverte après inscription');

    const stored = customersRepo.findByEmail('lea@exemple.fr');
    assert.notEqual(stored.passwordHash, NEW.password);
    assert.ok(await verifyPassword(NEW.password, stored.passwordHash));

    const login = await client()('POST', '/api/auth/login', { email: 'lea@exemple.fr', password: NEW.password });
    assert.equal(login.status, 200, 'le nouveau compte peut se reconnecter');
  });

  test('refuse un e-mail déjà utilisé (quelle que soit la casse)', async () => {
    const res = await client()('POST', '/api/auth/register', { ...NEW, email: 'LEA@exemple.FR' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'EMAIL_TAKEN');
    assert.equal(res.body.error.field, 'email');
  });

  test('refuse un mot de passe trop faible en indiquant le champ', async () => {
    const res = await client()('POST', '/api/auth/register', { ...NEW, email: 'autre@exemple.fr', password: 'abc' });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'WEAK_PASSWORD');
    assert.equal(res.body.error.field, 'password');
    assert.equal(customersRepo.findByEmail('autre@exemple.fr'), undefined, 'aucun compte créé');
  });
});

describe('protection CSRF', () => {
  test('refuse un formulaire non JSON et une autre origine', async () => {
    const form = await fetch(`${base}/api/auth/logout`, { method: 'POST', body: new URLSearchParams({ a: '1' }) });
    assert.equal(form.status, 415);
    const crossOrigin = await fetch(`${base}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://evil.test' },
      body: '{}',
    });
    assert.equal(crossOrigin.status, 403);
  });
});

describe('panier et paiement fictif', () => {
  test('recalcule le total après chaque modification et passe la commande', async () => {
    const call = await loggedIn();

    const catalogue = await call('GET', '/api/catalogue');
    assert.deepEqual(catalogue.body.products.map((p) => p.priceCents), [49999, 10]);

    let cart = (await call('POST', '/api/cart/items', { productId: A })).body;
    assert.equal(cart.totalCents, 49999);
    cart = (await call('POST', '/api/cart/items', { productId: B, quantity: 3 })).body;
    assert.equal(cart.totalCents, 49999 + 30, 'pas d’erreur d’arrondi flottant (0,1 × 3)');
    cart = (await call('PATCH', `/api/cart/items/${A}`, { quantity: 2 })).body;
    assert.equal(cart.totalCents, 99998 + 30);
    cart = (await call('DELETE', `/api/cart/items/${B}`)).body;
    assert.equal(cart.totalCents, 99998);
    assert.equal(cart.count, 2);

    assert.equal((await call('PATCH', `/api/cart/items/${A}`, { quantity: 100 })).status, 400);

    const key = '11111111-2222-4333-8444-555555555555';
    const stale = await call('POST', '/api/checkout', { checkoutKey: key, expectedTotalCents: 1 });
    assert.equal(stale.body.error.code, 'PRICE_CHANGED');

    const paid = await call('POST', '/api/checkout', { checkoutKey: key, expectedTotalCents: 99998 });
    assert.equal(paid.status, 201);
    assert.match(paid.body.order.reference, /^GS-[0-9A-F]{8}$/);
    assert.equal(paid.body.order.totalCents, 99998);
    assert.equal(paid.body.order.status, 'simulated');
    assert.equal(paid.body.order.customerId, undefined, 'identifiant interne non exposé');

    const replay = await call('POST', '/api/checkout', { checkoutKey: key });
    assert.equal(replay.status, 200);
    assert.equal(replay.body.order.reference, paid.body.order.reference, 'idempotent');

    assert.equal((await call('GET', '/api/cart')).body.count, 0);
    const order = await call('GET', `/api/orders/${paid.body.order.reference}`);
    assert.equal(order.body.order.items[0].quantity, 2);

    const empty = await call('POST', '/api/checkout', { checkoutKey: '11111111-2222-4333-8444-666666666666' });
    assert.equal(empty.body.error.code, 'EMPTY_CART');
  });

  test('refuse un article absent de Strapi', async () => {
    const call = await loggedIn();
    assert.equal((await call('POST', '/api/cart/items', { productId: 'zzzzzzzzzzzzzzzzzzzzzzzz' })).status, 404);
  });

  test('ne montre pas la commande d’un autre client', async () => {
    const call = await loggedIn();
    assert.equal((await call('GET', '/api/orders/GS-00000000')).status, 404);
    assert.equal((await call('GET', '/api/orders/pas-une-reference')).status, 404);
  });
});
