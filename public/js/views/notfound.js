import { stateBlock } from '../components/feedback.js';
import { h } from '../core/dom.js';

/** @type {import('../core/router.js').View} */
export function renderNotFound(main) {
  main.replaceChildren(h('div', { class: 'container page page--narrow' }, stateBlock({
    iconName: 'info',
    headingLevel: 'h1',
    title: 'Page introuvable',
    text: 'Cette page n’existe pas ou a été déplacée.',
    action: h('a', { class: 'button button--primary', href: '/', 'data-link': true }, 'Retour au catalogue'),
  })));
}
