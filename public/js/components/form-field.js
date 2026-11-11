import { h } from '../core/dom.js';

/**
 * Champ de formulaire accessible : libellé associé (éventuellement masqué visuellement),
 * consigne et message d'erreur reliés par aria-describedby, état aria-invalid effacé
 * dès que l'utilisateur corrige.
 *
 * @param {{
 *   id: string, label: string, type?: string, autocomplete?: string, placeholder?: string,
 *   hideLabel?: boolean, hint?: string, addon?: Node,
 * }} options `hideLabel` garde le libellé pour les lecteurs d'écran ; `hint` : consigne affichée sous le champ ;
 *   `addon` : contrôle affiché dans le champ
 */
export function formField({ id, label, type = 'text', autocomplete, placeholder, hideLabel = false, hint, addon }) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const isEmail = type === 'email';
  const input = h('input', {
    id, name: id, type, autocomplete, placeholder, required: true, class: 'input',
    'aria-describedby': hint ? `${hintId} ${errorId}` : errorId,
    spellcheck: 'false',
    autocapitalize: isEmail ? 'none' : null,
    inputmode: isEmail ? 'email' : null,
  });
  const error = h('p', { id: errorId, class: 'field__error' });

  /** @param {string} [message] message d'erreur, ou vide pour effacer */
  const setError = (message = '') => {
    error.textContent = message;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  /** Marque le champ invalide sans message propre (l'erreur est affichée ailleurs). */
  const markInvalid = () => input.setAttribute('aria-invalid', 'true');

  input.addEventListener('input', () => {
    if (input.hasAttribute('aria-invalid')) setError('');
  });

  const element = h('div', { class: 'field' },
    h('label', { for: id, class: hideLabel ? 'visually-hidden' : 'field__label' }, label),
    addon ? h('div', { class: 'input-group' }, input, addon) : input,
    hint && h('p', { id: hintId, class: 'field__hint' }, hint),
    error,
  );

  return { element, input, setError, markInvalid };
}
