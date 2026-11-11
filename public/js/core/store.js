import { api } from './api.js';

/** État partagé : client connecté et panier (source de vérité côté serveur). */
const state = { customer: null, cart: null };
const subscribers = new Set();

export const store = {
  get customer() {
    return state.customer;
  },
  get cart() {
    return state.cart;
  },
  setCustomer(customer) {
    state.customer = customer;
    if (!customer) state.cart = null;
    notify();
  },
  setCart(cart) {
    state.cart = cart;
    notify();
  },
  subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
  /** Charge le panier ; renvoie null en cas d'erreur (le badge reste simplement masqué). */
  async refreshCart() {
    try {
      const cart = await api.cart();
      this.setCart(cart);
      return cart;
    } catch {
      return null;
    }
  },
  quantityOf(productId) {
    return state.cart?.items.find((item) => item.productId === productId)?.quantity ?? 0;
  },
};

function notify() {
  subscribers.forEach((fn) => fn(state));
}
