import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';

const placeholder = (frame) => {
  frame.classList.add('media--empty');
  frame.append(icon('gamepad', { size: 36 }));
};

/**
 * Visuel produit avec fondu au chargement et repli si l'image est absente ou en erreur.
 * @param {{ src: string, srcset?: string, width?: number, height?: number, alt?: string } | null} image
 * @param {{ sizes?: string, className?: string, eager?: boolean }} [options]
 */
export function productImage(image, { sizes = '(max-width: 560px) 128px, 320px', className = '', eager = false } = {}) {
  const frame = h('div', { class: `media ${className}`.trim() });
  if (!image?.src) {
    placeholder(frame);
    return frame;
  }
  const img = h('img', {
    src: image.src,
    srcset: image.srcset || null,
    sizes: image.srcset ? sizes : null,
    alt: image.alt ?? '',
    width: image.width,
    height: image.height,
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    onload: () => frame.classList.add('is-loaded'),
    onerror: () => {
      img.remove();
      placeholder(frame);
    },
  });
  // Image déjà en cache (ex. en changeant de filtre) : pas de fondu, affichage immédiat.
  if (img.complete && img.naturalWidth > 0) frame.classList.add('is-loaded');
  frame.append(img);
  return frame;
}
