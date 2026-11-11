import { h, srOnly } from '../core/dom.js';
import { icon } from '../core/icons.js';

const SAFE_RETURN_RE = /^\/(?!\/)[\w\-/?=&%.+]*$/;
const AUTH_PATHS = ['/connexion', '/inscription'];

/**
 * Destination après connexion ou inscription : uniquement un chemin interne
 * (pas de redirection ouverte) et jamais une autre page d'authentification.
 * @param {string | null} value paramètre `retour` de l'URL
 */
export const safeReturnPath = (value) =>
  (value && SAFE_RETURN_RE.test(value) && !AUTH_PATHS.some((p) => value.startsWith(p)) ? value : '/');

/** Ajoute le paramètre `retour` à un lien entre les pages d'authentification. */
export const withReturn = (path, returnTo) =>
  (returnTo && safeReturnPath(returnTo) !== '/' ? `${path}?retour=${encodeURIComponent(returnTo)}` : path);

/** Décor de fond : deux disques lumineux et un faisceau diagonal (purement visuel). */
const backdrop = () => h('div', { class: 'auth__backdrop', 'aria-hidden': 'true' },
  h('span', { class: 'auth__orb auth__orb--top' }),
  h('span', { class: 'auth__orb auth__orb--bottom' }),
  h('span', { class: 'auth__beam' }),
);

/**
 * Page d'authentification plein écran : fond sombre et carte en verre centrée.
 * @param {{ titleId: string, title: string, lead?: string }} heading
 * @param {...Node} children contenu de la carte
 */
export function authPage({ titleId, title, lead }, ...children) {
  return h('div', { class: 'auth' },
    backdrop(),
    h('section', { class: 'auth__card', 'aria-labelledby': titleId },
      h('h1', { id: titleId, class: 'auth__title' }, title),
      lead && h('p', { class: 'auth__lead' }, lead),
      ...children,
    ),
  );
}

/**
 * Bouton afficher / masquer le mot de passe.
 * @param {() => HTMLInputElement} getInput
 * @param {string} controls identifiant du champ contrôlé
 */
export function passwordToggle(getInput, controls) {
  const label = srOnly('Afficher le mot de passe');
  const button = h('button', {
    type: 'button', class: 'input-toggle', 'aria-pressed': 'false', 'aria-controls': controls,
    onclick: () => {
      const input = getInput();
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(reveal));
      button.replaceChildren(icon(reveal ? 'eyeOff' : 'eye', { size: 18 }), label);
    },
  }, icon('eye', { size: 18 }), label);
  return button;
}
