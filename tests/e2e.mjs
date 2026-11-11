/**
 * Parcours de bout en bout, sur ordinateur et sur mobile :
 * connexion (erreurs comprises) → catalogue Strapi → ajout / retrait → total → paiement fictif → confirmation.
 * Vérifie aussi l'état « catalogue indisponible » avec une seconde instance pointant vers un Strapi injoignable.
 *
 * Prérequis : Strapi et la boutique démarrés (npm start). Utilise Chrome ou Edge installé (playwright-core).
 *   npm run test:e2e
 * Variables : SHOP_URL (défaut http://127.0.0.1:3000), BROWSER_CHANNEL (chrome | msedge), SCREENSHOT_DIR.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOP = process.env.SHOP_URL || 'http://127.0.0.1:3000';
const STRAPI = (process.env.STRAPI_URL || 'http://localhost:1337').replace(/\/+$/, '');
const SHOTS = path.resolve(process.env.SCREENSHOT_DIR || path.join(root, 'test-results'));
const DEMO = { email: process.env.DEMO_EMAIL || 'demo@gameshop.test', password: process.env.DEMO_PASSWORD || 'Console2026!' };
fs.mkdirSync(SHOTS, { recursive: true });

const euro = (cents) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const norm = (s) => s.replace(/\s/g, ' ');
const log = (...args) => console.log('  ✓', ...args);

const profiles = {
  desktop: { viewport: { width: 1366, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

async function strapiProducts() {
  const res = await fetch(`${STRAPI}/api/articles?populate=Picture&pagination[pageSize]=100`);
  assert.equal(res.status, 200, 'Strapi doit répondre sur /api/articles');
  const { data } = await res.json();
  return data.map((a) => ({ id: a.documentId, name: a.Product_name.trim(), cents: Math.round(Number(a.Price) * 100) }));
}

async function assertNoHorizontalScroll(page, label) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(overflow <= 0, `${label} : défilement horizontal de ${overflow}px`);
}

async function shot(page, name) {
  // Mobile : capture de l'écran visible (rendu réel des éléments collants) ; ordinateur : page entière.
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: !name.startsWith('mobile') });
}

async function runJourney(browser, profileName, products) {
  console.log(`\n▶ Parcours ${profileName}`);
  const context = await browser.newContext({ ...profiles[profileName], locale: 'fr-FR', reducedMotion: 'reduce' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/401|409/.test(m.text())) errors.push(m.text()); });

  // 1. Redirection vers la connexion
  await page.goto(`${SHOP}/panier`);
  await page.waitForURL(/\/connexion\?retour=%2Fpanier$/);
  await page.getByRole('heading', { level: 1, name: 'Connexion' }).waitFor();
  log('accès protégé → redirection vers /connexion');
  await assertNoHorizontalScroll(page, 'connexion');
  await shot(page, `${profileName}-01-connexion`);

  // 2. Champs vides
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByText('Saisissez votre adresse e-mail.').waitFor();
  assert.equal(await page.getByLabel('Adresse e-mail').getAttribute('aria-invalid'), 'true');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'email', 'le focus va au premier champ invalide');
  log('validation des champs vides + focus sur le champ en erreur');

  // 3. Identifiants incorrects
  await page.getByLabel('Adresse e-mail').fill(DEMO.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('alert').filter({ hasText: 'Identifiants incorrects' }).waitFor();
  await shot(page, `${profileName}-02-identifiants-incorrects`);
  log('identifiants incorrects → alerte affichée');

  // 4. Connexion au clavier (Entrée) → retour vers /panier demandé, puis catalogue
  await page.getByLabel('Mot de passe', { exact: true }).fill(DEMO.password);
  await page.getByLabel('Mot de passe', { exact: true }).press('Enter');
  await page.waitForURL(`${SHOP}/panier`);
  log('connexion réussie (touche Entrée) → retour à la page demandée');

  // Panier remis à zéro pour un parcours reproductible
  await page.evaluate(async () => {
    const { items } = await (await fetch('/api/cart')).json();
    for (const item of items) await fetch(`/api/cart/items/${item.productId}`, { method: 'DELETE' });
  });

  await page.getByRole('link', { name: /GameShop/ }).click();
  await page.getByRole('heading', { level: 1, name: 'Tous les produits' }).waitFor();
  const cards = page.locator('.grid > li.card:not(.card--skeleton)');
  await cards.first().waitFor();
  const names = await page.locator('.card__title').allTextContents();
  assert.deepEqual([...names].sort(), products.map((p) => p.name).sort(), 'le catalogue affiche les articles publiés de Strapi');
  for (const p of products) {
    const card = cards.filter({ has: page.getByRole('heading', { name: p.name, exact: true }) });
    // « Prix : » est un libellé réservé aux lecteurs d'écran (visually-hidden).
    assert.equal(norm(await card.locator('.card__price').innerText()), norm(`Prix : ${euro(p.cents)}`), `prix de ${p.name}`);
  }
  await page.waitForFunction(() => [...document.querySelectorAll('.card img')].every((img) => img.complete && img.naturalWidth > 0));
  log(`${products.length} articles chargés depuis Strapi avec prix et visuels`);
  await assertNoHorizontalScroll(page, 'catalogue');
  await shot(page, `${profileName}-03-catalogue`);

  // 4b. Navigation du catalogue : tranche de prix, recherche (filtres dans l'URL)
  const nav = page.getByRole('navigation', { name: 'Navigation du catalogue' });
  const settled = () => page.locator('.catalogue__body:not([aria-busy]) > :is(.grid, .state)').waitFor();
  const titles = async () => page.locator('.grid > li.card .card__title').allTextContents();

  await nav.getByRole('link', { name: 'Moins de 100 €' }).click();
  await page.getByRole('heading', { level: 1, name: 'Moins de 100 €' }).waitFor();
  await settled();
  assert.deepEqual((await titles()).sort(), products.filter((p) => p.cents < 10_000).map((p) => p.name).sort());
  log('navigation « Moins de 100 € » → articles filtrés');

  const word = products[0].name.split(' ')[0];
  await page.getByRole('searchbox', { name: 'Rechercher un produit' }).fill(word);
  await page.getByRole('searchbox', { name: 'Rechercher un produit' }).press('Enter');
  await page.getByRole('heading', { level: 1, name: `Résultats pour « ${word} »` }).waitFor();
  await settled();
  const found = await titles();
  assert.ok(found.length > 0 && found.every((t) => t.toLowerCase().includes(word.toLowerCase())), `recherche « ${word} »`);
  log(`recherche « ${word} » → ${found.length} résultat(s)`);

  await nav.getByRole('link', { name: 'Tous les produits' }).click();
  await page.getByRole('heading', { level: 1, name: 'Tous les produits' }).waitFor();
  await settled();

  // 5. Navigation clavier. Après une navigation interne, le focus est sur le titre H1 :
  //    Tab mène directement au premier article.
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Ajouter au panier');
  // Au chargement initial, le premier Tab atteint le lien d'évitement.
  await page.reload();
  await cards.first().waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Aller au contenu principal');
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(outline, 'none', 'le focus clavier est visible');
  const firstAdd = page.getByRole('button', { name: 'Ajouter au panier' }).first();
  await firstAdd.focus();
  const addOutline = await firstAdd.evaluate((el) => `${getComputedStyle(el).outlineStyle  } ${  getComputedStyle(el).outlineWidth}`);
  assert.match(addOutline, /solid 3px/);
  log('lien d’évitement + anneau de focus visible sur les actions');

  // 6. Ajout de deux articles (un au clavier)
  const [a, b] = [...products].sort((x, y) => x.cents - y.cents).slice(-2); // deux articles distincts
  const addButton = (p) => cards.filter({ has: page.getByRole('heading', { name: p.name, exact: true }) }).getByRole('button', { name: 'Ajouter au panier' });
  await addButton(a).focus();
  await page.keyboard.press('Enter');
  await page.locator('.toast').filter({ hasText: `${a.name} a été ajouté au panier.` }).waitFor();
  await addButton(b).click();
  await page.locator('.badge:not([hidden])').filter({ hasText: '2' }).waitFor();
  await shot(page, `${profileName}-04-ajout-panier`);
  log(`ajout de « ${a.name} » (clavier) et « ${b.name} » → badge = 2`);

  // 7. Panier : total, quantité +1, retrait
  await page.getByRole('link', { name: /^Panier/ }).click();
  await page.getByRole('heading', { level: 1, name: 'Votre panier' }).waitFor();
  const total = page.locator('#cart-total');
  assert.equal(norm(await total.innerText()), norm(euro(a.cents + b.cents)));
  log(`total initial ${euro(a.cents + b.cents)}`);

  await page.getByRole('button', { name: `Augmenter la quantité de ${a.name}` }).click();
  await page.waitForFunction(([sel, txt]) => document.querySelector(sel)?.innerText.replace(/\s/g, ' ') === txt, ['#cart-total', norm(euro(2 * a.cents + b.cents))]);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), `Augmenter la quantité de ${a.name}`, 'le focus reste sur le bouton +');
  log(`quantité ${a.name} → 2, total ${euro(2 * a.cents + b.cents)}`);

  await page.getByRole('button', { name: `Retirer ${b.name} du panier` }).click();
  await page.waitForFunction(([sel, txt]) => document.querySelector(sel)?.innerText.replace(/\s/g, ' ') === txt, ['#cart-total', norm(euro(2 * a.cents))]);
  assert.equal(await page.locator('.line').count(), 1);
  await page.locator('#announcer').filter({ hasText: `${b.name} a été retiré du panier` }).waitFor();
  log(`retrait de ${b.name}, total recalculé ${euro(2 * a.cents)} (annoncé aux lecteurs d’écran)`);
  await assertNoHorizontalScroll(page, 'panier');
  await shot(page, `${profileName}-05-panier`);

  // 8. Paiement fictif
  // Sur mobile, la barre collante ou le bouton du récapitulatif selon ce qui est à l'écran.
  await page.locator('a[href="/paiement"]:visible').first().click();
  await page.getByRole('heading', { level: 1, name: 'Paiement' }).waitFor();
  await page.getByText('aucune donnée bancaire n’est demandée', { exact: false }).waitFor();
  assert.equal(await page.locator('main input').count(), 0, 'aucun champ de saisie dans la page (pas de données bancaires)');
  await shot(page, `${profileName}-06-paiement`);
  const confirm = page.getByRole('button', { name: /Confirmer le paiement fictif/ });
  assert.match(norm(await confirm.innerText()), new RegExp(norm(euro(2 * a.cents)).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await confirm.click();
  await page.getByText('Paiement en cours…').waitFor();
  await page.waitForURL(/\/confirmation\/GS-[0-9A-F]{8}$/);
  await page.getByRole('heading', { level: 1, name: 'Paiement confirmé' }).waitFor();
  const ref = page.url().split('/').pop();
  assert.equal(norm(await page.locator('.receipt .summary__row--total dd').innerText()), norm(euro(2 * a.cents)));
  await page.getByText('aucun montant n’a été débité').waitFor();
  assert.ok(await page.locator('.badge').isHidden(), 'badge masqué : panier vidé');
  await assertNoHorizontalScroll(page, 'confirmation');
  await shot(page, `${profileName}-07-confirmation`);
  log(`paiement fictif confirmé, référence ${ref}, total ${euro(2 * a.cents)}`);

  // 9. Rechargement de la confirmation + panier vide
  await page.reload();
  await page.getByRole('heading', { level: 1, name: 'Paiement confirmé' }).waitFor();
  await page.getByRole('link', { name: /^Panier/ }).click();
  await page.getByRole('heading', { name: 'Votre panier est vide' }).waitFor();
  await shot(page, `${profileName}-08-panier-vide`);
  log('confirmation persistante après rechargement, panier vide affiché');

  // 10. Déconnexion
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.waitForURL(`${SHOP}/connexion`);
  log('déconnexion');

  assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(' | ')}`);
  await context.close();
}

/**
 * Lance une instance temporaire de la boutique (base SQLite jetable) le temps de `fn`.
 * Évite de polluer la vraie base avec des comptes de test.
 */
async function withTempShop({ port, strapiUrl = STRAPI, strapiTimeoutMs = 6000 }, fn) {
  const dbPath = path.join(os.tmpdir(), `gameshop-e2e-${port}-${Date.now()}.db`);
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), STRAPI_URL: strapiUrl, DB_PATH: dbPath, STRAPI_TIMEOUT_MS: String(strapiTimeoutMs) },
    stdio: 'ignore',
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 50; i++) {
      try { if ((await fetch(`${base}/api/auth/me`)).ok) break; } catch { /* démarrage */ }
      await new Promise((r) => setTimeout(r, 200));
    }
    await fn(base);
  } finally {
    const exited = once(child, 'exit');
    child.kill();
    await exited;
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbPath + suffix, { force: true, maxRetries: 5, retryDelay: 200 });
  }
}

/** Instance branchée sur un Strapi injoignable : état d'erreur du catalogue. */
async function runCatalogueErrorState(browser) {
  console.log('\n▶ Strapi injoignable');
  await withTempShop({ port: 3999, strapiUrl: 'http://127.0.0.1:9', strapiTimeoutMs: 1500 }, async (base) => {
    for (const profileName of ['desktop', 'mobile']) {
      const context = await browser.newContext({ ...profiles[profileName], locale: 'fr-FR', reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.goto(`${base}/connexion`);
      await page.getByLabel('Adresse e-mail').fill(DEMO.email);
      await page.getByLabel('Mot de passe', { exact: true }).fill(DEMO.password);
      await page.getByRole('button', { name: 'Se connecter' }).click();
      await page.getByRole('heading', { name: 'Impossible de charger le catalogue' }).waitFor();
      await page.getByRole('button', { name: 'Réessayer' }).waitFor();
      await shot(page, `${profileName}-09-catalogue-erreur`);
      await context.close();
    }
    log('message d’erreur + bouton « Réessayer » (ordinateur et mobile)');
  });
}

/** Inscription d'un nouveau client, sur une instance à base jetable. */
async function runRegistration(browser) {
  console.log('\n▶ Inscription');
  await withTempShop({ port: 3998 }, async (base) => {
    for (const profileName of ['desktop', 'mobile']) {
      const context = await browser.newContext({ ...profiles[profileName], locale: 'fr-FR', reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      const account = { name: 'Léa Dupont', email: `lea.${profileName}@exemple.fr`, password: 'Manette2026' };
      const field = (label) => page.getByLabel(label, { exact: true });

      // Depuis la page de connexion, le lien « Créer un compte » mène à l'inscription.
      await page.goto(`${base}/panier`);
      await page.getByRole('link', { name: 'Créer un compte' }).click();
      await page.waitForURL(/\/inscription\?retour=%2Fpanier$/);
      await page.getByRole('heading', { level: 1, name: 'Inscription' }).waitFor();
      await assertNoHorizontalScroll(page, 'inscription');
      await shot(page, `${profileName}-10-inscription`);

      // Validation côté navigateur : champs vides puis mots de passe différents
      await page.getByRole('button', { name: 'Créer mon compte' }).click();
      await page.getByText('Saisissez votre nom').waitFor();
      assert.equal(await page.evaluate(() => document.activeElement.id), 'name');
      await field('Nom complet').fill(account.name);
      await field('Adresse e-mail').fill(account.email);
      await field('Mot de passe').fill('court');
      await field('Confirmer le mot de passe').fill('autre');
      await page.getByRole('button', { name: 'Créer mon compte' }).click();
      await page.getByText('au moins 8 caractères, dont une lettre et un chiffre').last().waitFor();
      await field('Mot de passe').fill(account.password);
      await page.getByRole('button', { name: 'Créer mon compte' }).click();
      await page.getByText('Les deux mots de passe ne correspondent pas.').waitFor();
      await shot(page, `${profileName}-11-inscription-erreurs`);
      log('validation : champs requis, mot de passe trop faible, confirmation différente');

      // Création du compte → connecté et renvoyé vers la page demandée
      await field('Confirmer le mot de passe').fill(account.password);
      await page.getByRole('button', { name: 'Créer mon compte' }).click();
      await page.waitForURL(`${base}/panier`);
      await page.locator('.toast').filter({ hasText: 'Bienvenue Léa ! Votre compte a été créé.' }).waitFor();
      log('compte créé → connecté et renvoyé vers le panier demandé');

      // Déconnexion puis reconnexion avec le nouveau compte
      await page.getByRole('button', { name: 'Se déconnecter' }).click();
      await page.waitForURL(`${base}/connexion`);
      await field('Adresse e-mail').fill(account.email);
      await field('Mot de passe').fill(account.password);
      await page.getByRole('button', { name: 'Se connecter' }).click();
      await page.waitForURL(`${base}/`);
      log('reconnexion avec le nouveau compte');

      // Même e-mail une seconde fois : refusé, message sous le champ e-mail
      await page.getByRole('button', { name: 'Se déconnecter' }).click();
      await page.goto(`${base}/inscription`);
      await field('Nom complet').fill('Autre Personne');
      await field('Adresse e-mail').fill(account.email.toUpperCase());
      await field('Mot de passe').fill(account.password);
      await field('Confirmer le mot de passe').fill(account.password);
      await page.getByRole('button', { name: 'Créer mon compte' }).click();
      await page.getByText('Un compte existe déjà avec cette adresse e-mail.', { exact: false }).waitFor();
      assert.equal(await field('Adresse e-mail').getAttribute('aria-invalid'), 'true');
      log('e-mail déjà utilisé → refusé, erreur sous le champ');

      assert.deepEqual(errors, [], `erreurs JavaScript : ${errors.join(' | ')}`);
      await context.close();
    }
  });
}

/** Capture l'état de chargement du catalogue (réponse retardée). */
async function runLoadingState(browser) {
  const context = await browser.newContext({ ...profiles.desktop, locale: 'fr-FR' });
  const page = await context.newPage();
  await page.goto(`${SHOP}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(DEMO.email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(DEMO.password);
  await page.route('**/api/catalogue', async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByRole('status').filter({ hasText: 'Chargement du catalogue…' }).waitFor({ state: 'attached' });
  await page.locator('.card--skeleton').first().waitFor();
  await page.screenshot({ path: path.join(SHOTS, 'desktop-00-chargement.png') });
  log('état de chargement (squelettes + annonce)');
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await context.close();
}

const channel = process.env.BROWSER_CHANNEL || 'chrome';
const browser = await chromium.launch({ channel, headless: true });
try {
  const products = await strapiProducts();
  assert.ok(products.length >= 2, 'au moins deux articles publiés sont nécessaires');
  await runJourney(browser, 'desktop', products);
  await runJourney(browser, 'mobile', products);
  console.log('\n▶ États');
  await runLoadingState(browser);
  await runCatalogueErrorState(browser);
  await runRegistration(browser);
  console.log(`\nParcours OK. Captures : ${SHOTS}`);
} finally {
  await browser.close();
}
