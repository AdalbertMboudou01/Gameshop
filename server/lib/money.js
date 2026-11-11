/**
 * Les montants circulent en centimes (entiers) pour éviter les erreurs d'arrondi flottant.
 * @param {unknown} amount montant décimal (ex. 329.99)
 * @returns {number} centimes, ou NaN si le montant est absent ou invalide
 */
export function toCents(amount) {
  if (amount == null || amount === '') return Number.NaN;
  const value = Number(amount);
  return Number.isFinite(value) ? Math.round(value * 100) : Number.NaN;
}

/** @param {number} cents */
export const isValidPrice = (cents) => Number.isInteger(cents) && cents >= 0;
