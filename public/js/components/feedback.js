import { TOAST_DURATION_MS } from '../config.js';
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';

const MOBILE_QUERY = window.matchMedia('(max-width: 639px)');
const LEAVE_ANIMATION_MS = 200;

/** Annonce un message aux lecteurs d'écran sans déplacer le focus. */
export function announce(message) {
  const region = document.getElementById('announcer');
  region.textContent = '';
  // Le court délai permet de ré-annoncer une phrase identique.
  setTimeout(() => { region.textContent = message; }, 60);
}

/**
 * Notification éphémère (région role=status), avec action facultative.
 * Se met en pause au survol et au focus ; une seule à la fois sur mobile.
 * @param {string} message
 * @param {{ tone?: 'success' | 'error', action?: { href: string, label: string }, duration?: number }} [options]
 */
export function toast(message, { tone = 'success', action, duration = TOAST_DURATION_MS } = {}) {
  const region = document.getElementById('toasts');
  let timer;

  const close = () => {
    clearTimeout(timer);
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), LEAVE_ANIMATION_MS);
  };
  const start = () => { timer = setTimeout(close, duration); };
  const pause = () => clearTimeout(timer);

  const el = h('div', {
    class: `toast toast--${tone}`,
    onmouseenter: pause, onmouseleave: start, onfocusin: pause, onfocusout: start,
  },
    icon(tone === 'error' ? 'alert' : 'checkCircle', { size: 20 }),
    h('p', { class: 'toast__text' }, message),
    action && h('a', { class: 'toast__action', href: action.href, 'data-link': true, onclick: close }, action.label),
    h('button', { type: 'button', class: 'toast__close', 'aria-label': 'Fermer la notification', onclick: close },
      icon('close', { size: 18 })),
  );

  region.append(el);
  const max = MOBILE_QUERY.matches ? 1 : 2;
  while (region.children.length > max) region.firstElementChild.remove();
  start();
}

/** Retire toutes les notifications (au changement de page). */
export function clearToasts() {
  document.getElementById('toasts').replaceChildren();
}

/** Message d'alerte en ligne (role=alert pour une erreur, role=status sinon). */
export function alertBox(message, { tone = 'error', title } = {}) {
  return h('div', { class: `alert alert--${tone}`, role: tone === 'error' ? 'alert' : 'status' },
    icon(tone === 'error' ? 'alert' : 'info', { size: 20 }),
    h('div', {}, title && h('p', { class: 'alert__title' }, title), h('p', {}, message)),
  );
}

/**
 * Bloc d'état plein (vide, erreur, introuvable) avec icône, titre, texte et action.
 * @param {{ tone?: 'neutral' | 'error', iconName?: string, title: string, text?: string, action?: Node, headingLevel?: 'h1' | 'h2', role?: string }} options
 */
export function stateBlock({ tone = 'neutral', iconName = 'info', title, text, action, headingLevel = 'h2', role }) {
  return h('section', { class: `state state--${tone}`, role },
    h('div', { class: 'state__icon' }, icon(iconName, { size: 28 })),
    h(headingLevel, { class: 'state__title', tabindex: headingLevel === 'h1' ? '-1' : null }, title),
    text && h('p', { class: 'state__text' }, text),
    action,
  );
}

/** État d'erreur avec bouton « Réessayer ». */
export function errorState({ title, error, onRetry }) {
  return stateBlock({
    tone: 'error',
    iconName: 'alert',
    role: 'alert',
    title,
    text: error.message,
    action: h('button', { type: 'button', class: 'button button--secondary', onclick: onRetry },
      icon('refresh', { size: 18 }), h('span', {}, 'Réessayer')),
  });
}

/** Ligne de chargement annoncée (role=status). */
export const loadingLine = (label) =>
  h('p', { class: 'loading-line', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), label);

/**
 * Passe un bouton en état « occupé » (spinner + libellé, largeur conservée).
 * @returns {() => void} restaure l'état initial
 */
export function setBusy(button, label) {
  const previous = [...button.childNodes];
  button.style.minWidth = `${button.offsetWidth}px`;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', {}, label));
  return () => {
    button.disabled = false;
    button.removeAttribute('aria-busy');
    button.style.minWidth = '';
    button.replaceChildren(...previous);
  };
}
