/**
 * Création d'éléments DOM sans innerHTML : le texte passe par des nœuds texte (pas d'injection).
 *
 * @param {string} tag
 * @param {Record<string, unknown>} [attrs] `class`, `dataset`, gestionnaires `onX`, attributs ; null/false sont ignorés
 * @param {...unknown} children nœuds, textes ou tableaux (null/false ignorés)
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** Texte lu par les lecteurs d'écran uniquement. */
export const srOnly = (text) => h('span', { class: 'visually-hidden' }, text);
