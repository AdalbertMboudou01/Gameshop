/** Formatage pour l'affichage (français, euros). Les montants arrivent du serveur en centimes. */

const currency = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

/** @param {number} cents */
export const formatPrice = (cents) => currency.format(cents / 100);

/** @param {string} iso */
export const formatDate = (iso) => dateTime.format(new Date(iso));

/** plural(2, 'article') → « 2 articles » */
export const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`;
