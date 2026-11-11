import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createStrapiCatalogue } from '../../server/catalogue/strapi-catalogue.js';
import { toProduct } from '../../server/catalogue/strapi-mapper.js';
import { loadConfig } from '../../server/config.js';
import { parseCookies, serializeCookie } from '../../server/http/cookies.js';
import { CatalogueUnavailableError } from '../../server/lib/errors.js';
import { toCents } from '../../server/lib/money.js';
import { hashPassword, verifyPassword } from '../../server/lib/passwords.js';
import { createRateLimiter } from '../../server/lib/rate-limiter.js';
import { validateRegistration } from '../../server/services/account-rules.js';
import { isValidQuantity, summarizeCart } from '../../server/services/cart-service.js';

describe('mots de passe', () => {
  test('hachage scrypt salé et vérification', async () => {
    const hash = await hashPassword('Console2026!');
    assert.match(hash, /^scrypt\$32768\$8\$1\$/);
    assert.ok(!hash.includes('Console2026!'));
    assert.notEqual(hash, await hashPassword('Console2026!'), 'sel aléatoire');
    assert.equal(await verifyPassword('Console2026!', hash), true);
    assert.equal(await verifyPassword('console2026!', hash), false);
    assert.equal(await verifyPassword('x', 'format-invalide'), false);
  });
});

describe('montants', () => {
  test('conversion en centimes', () => {
    assert.equal(toCents(329.99), 32999);
    assert.equal(toCents('49.99'), 4999);
    assert.ok(Number.isNaN(toCents(null)), 'un prix absent n’est pas 0');
    assert.ok(Number.isNaN(toCents('abc')));
  });
});

describe('articles Strapi', () => {
  test('normalisation (prix en centimes, image via /media)', () => {
    const product = toProduct({
      documentId: 'abc123def456ghi789',
      Product_name: ' PS 4 ',
      Price: 329.99,
      Picture: [{
        url: '/uploads/ps4.jpg', width: 736, height: 937, alternativeText: null, mime: 'image/jpeg',
        formats: {
          thumbnail: { url: '/uploads/thumbnail_ps4.jpg', width: 123 },
          small: { url: '/uploads/small_ps4.jpg', width: 393 },
        },
      }],
    });
    assert.equal(product.name, 'PS 4');
    assert.equal(product.priceCents, 32999);
    assert.equal(product.image.src, '/media/uploads/small_ps4.jpg');
    assert.equal(product.image.srcset, '/media/uploads/small_ps4.jpg 393w, /media/uploads/ps4.jpg 736w');
    assert.equal(product.image.alt, 'PS 4');
  });

  test('ignore les articles incomplets', () => {
    assert.equal(toProduct({ documentId: 'x', Product_name: '', Price: 10 }), null);
    assert.equal(toProduct({ documentId: 'x', Product_name: 'A', Price: null }), null);
    assert.equal(toProduct({ Product_name: 'A', Price: 10 }), null);
    assert.equal(toProduct({ documentId: 'x', Product_name: 'Sans image', Price: 10 }).image, null);
  });

  test('client : cache, requêtes simultanées dédoublonnées, erreur si Strapi échoue', async () => {
    let calls = 0;
    let time = 0;
    const catalogue = createStrapiCatalogue({
      url: 'http://strapi.test', timeoutMs: 100, cacheTtlMs: 1000, now: () => time,
      fetch: async () => {
        calls += 1;
        return Response.json({ data: [{ documentId: 'a1', Product_name: 'A', Price: 1 }], meta: { pagination: { pageCount: 1 } } });
      },
    });
    await Promise.all([catalogue.list(), catalogue.list()]);
    assert.equal(calls, 1, 'une seule requête pour deux appels simultanés');
    await catalogue.list();
    assert.equal(calls, 1, 'servi depuis le cache');
    time = 2000;
    await catalogue.list();
    assert.equal(calls, 2, 'cache expiré');

    const down = createStrapiCatalogue({
      url: 'http://strapi.test', timeoutMs: 100, cacheTtlMs: 0,
      fetch: async () => { throw new TypeError('fetch failed'); },
    });
    await assert.rejects(down.list(), CatalogueUnavailableError);
  });
});

describe('panier', () => {
  test('totaux et quantités', () => {
    const cart = summarizeCart([
      { productId: 'a', name: 'A', image: null, unitPriceCents: 1000, quantity: 2, lineTotalCents: 2000 },
      { productId: 'b', name: 'B', image: null, unitPriceCents: 10, quantity: 3, lineTotalCents: 30 },
    ]);
    assert.equal(cart.count, 5);
    assert.equal(cart.totalCents, 2030);
    assert.equal(summarizeCart([]).totalCents, 0);
    assert.ok(isValidQuantity(1) && isValidQuantity(99));
    assert.ok(!isValidQuantity(0) && !isValidQuantity(100) && !isValidQuantity(1.5) && !isValidQuantity('2'));
  });
});

describe('règles d’inscription', () => {
  const valid = { name: '  Léa   Dupont ', email: ' Lea.Dupont@Exemple.FR ', password: 'motdepasse1' };
  const fieldOf = (input) => {
    try { validateRegistration(input); return null; } catch (error) { return error.field; }
  };

  test('normalise le nom et l’e-mail', () => {
    assert.deepEqual(validateRegistration(valid), { name: 'Léa Dupont', email: 'lea.dupont@exemple.fr', password: 'motdepasse1' });
  });

  test('signale le champ invalide', () => {
    assert.equal(fieldOf({ ...valid, name: 'A' }), 'name');
    assert.equal(fieldOf({ ...valid, name: 'Nom\u0007bip' }), 'name', 'caractère de contrôle');
    assert.equal(validateRegistration({ ...valid, name: 'Léa\nDupont' }).name, 'Léa Dupont', 'retour à la ligne normalisé');
    assert.equal(fieldOf({ ...valid, email: 'pas-un-email' }), 'email');
    assert.equal(fieldOf({ ...valid, email: 'a@b' }), 'email');
    assert.equal(fieldOf({ ...valid, password: 'court1' }), 'password', 'moins de 8 caractères');
    assert.equal(fieldOf({ ...valid, password: 'sanschiffre' }), 'password', 'sans chiffre');
    assert.equal(fieldOf({ ...valid, password: '12345678' }), 'password', 'sans lettre');
    assert.equal(fieldOf({ ...valid, password: 'Été2026ok' }), null, 'lettres accentuées acceptées');
  });
});

describe('limiteur de tentatives', () => {
  test('bloque après N échecs puis se libère à la fin de la fenêtre', () => {
    let time = 0;
    const limiter = createRateLimiter({ max: 2, windowMs: 60_000, now: () => time });
    limiter.record('k');
    assert.equal(limiter.retryAfterSeconds('k'), 0);
    limiter.record('k');
    assert.equal(limiter.retryAfterSeconds('k'), 60);
    time = 60_001;
    assert.equal(limiter.retryAfterSeconds('k'), 0);
  });
});

describe('configuration', () => {
  test('valeurs par défaut et validation', () => {
    const config = loadConfig({});
    assert.equal(config.port, 3000);
    assert.equal(config.strapi.url, 'http://localhost:1337');
    assert.equal(loadConfig({ STRAPI_URL: 'http://x:1337///' }).strapi.url, 'http://x:1337');
    assert.throws(() => loadConfig({ PORT: 'abc' }), /PORT/);
    assert.throws(() => loadConfig({ STRAPI_URL: 'pas une url' }), /STRAPI_URL/);
  });
});

describe('cookies', () => {
  test('lecture et écriture', () => {
    assert.deepEqual(parseCookies('a=1; gs_session=abc%3D; mauvais'), { a: '1', gs_session: 'abc=' });
    assert.equal(serializeCookie('s', 'v', { maxAgeSeconds: 60, secure: true }),
      's=v; Path=/; HttpOnly; SameSite=Lax; Max-Age=60; Secure');
    assert.equal(serializeCookie('s', 'v', {}), 's=v; Path=/; HttpOnly; SameSite=Lax', 'cookie de session');
  });
});
