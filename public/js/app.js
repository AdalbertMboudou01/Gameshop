// Point d'entrée : routes, garde d'accès, en-tête et démarrage de la session.
import { createHeader } from './components/header.js';
import { announce, clearToasts, toast } from './components/feedback.js';
import { api, onUnauthorized } from './core/api.js';
import { cataloguePath } from './core/catalogue-filters.js';
import { createRouter } from './core/router.js';
import { store } from './core/store.js';
import { renderCart } from './views/cart.js';
import { renderCatalogue } from './views/catalogue.js';
import { renderCheckout } from './views/checkout.js';
import { renderConfirmation } from './views/confirmation.js';
import { renderLogin } from './views/login.js';
import { renderNotFound } from './views/notfound.js';
import { renderRegister } from './views/register.js';

const LOGIN_PATH = '/connexion';

/** @type {import('./core/router.js').Route[]} */
const routes = [
  { pattern: /^\/connexion$/, view: renderLogin, title: 'Connexion', public: true },
  { pattern: /^\/inscription$/, view: renderRegister, title: 'Inscription', public: true },
  { pattern: /^\/$/, view: renderCatalogue, title: 'Catalogue', nav: 'catalogue' },
  { pattern: /^\/panier$/, view: renderCart, title: 'Panier', nav: 'panier' },
  { pattern: /^\/paiement$/, view: renderCheckout, title: 'Paiement' },
  { pattern: /^\/confirmation\/(GS-[0-9A-F]{8})$/, view: renderConfirmation, title: 'Commande confirmée' },
];

const loginPathFor = (path) => (path === '/' ? LOGIN_PATH : `${LOGIN_PATH}?retour=${encodeURIComponent(path)}`);

const header = createHeader(
  {
    strip: document.getElementById('top-strip'),
    header: document.getElementById('site-header'),
    nav: document.getElementById('site-nav'),
  },
  { onLogout: logout, onSearch: (q) => router.navigate(cataloguePath({ q })) },
);

const router = createRouter({
  routes,
  notFound: renderNotFound,
  outlet: document.getElementById('main'),
  // Toute la boutique nécessite une connexion ; la page de connexion n'a plus de sens une fois connecté.
  guard(route, url) {
    if (route && !route.public && !store.customer) return loginPathFor(url.pathname + url.search);
    if (route?.public && store.customer) return '/';
    return null;
  },
  beforeRender(route, url) {
    clearToasts();
    // Les pages publiques (connexion) occupent tout l'écran, sans en-tête ni pied de page.
    document.body.classList.toggle('is-auth-page', Boolean(route?.public));
    document.title = `${route?.title ?? 'Page introuvable'} · GameShop`;
    header.render(route?.nav, url);
  },
});

async function logout() {
  try {
    await api.logout();
  } catch {
    // La session locale est fermée quoi qu'il arrive.
  }
  store.setCustomer(null);
  router.navigate(LOGIN_PATH, { replace: true });
  announce('Vous êtes déconnecté.');
}

onUnauthorized(() => {
  if (!store.customer) return;
  store.setCustomer(null);
  router.navigate(loginPathFor(location.pathname + location.search), { replace: true });
  toast('Votre session a expiré. Veuillez vous reconnecter.', { tone: 'error' });
});

async function boot() {
  try {
    const { customer } = await api.me();
    if (customer) {
      store.setCustomer(customer);
      store.refreshCart();
    }
  } catch {
    // Serveur injoignable : la page de connexion affichera l'erreur au moment de se connecter.
  }
  document.body.classList.remove('is-booting');
  await router.start();
}

boot();
