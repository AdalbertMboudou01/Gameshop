/** Constantes partagées par les vues (alignées sur les règles du serveur). */

export const MAX_QUANTITY = 99;

/** Règles de création de compte (mêmes valeurs que server/services/account-rules.js). */
export const ACCOUNT_RULES = Object.freeze({
  nameMinLength: 2,
  nameMaxLength: 60,
  passwordMinLength: 8,
  passwordMaxLength: 128,
});

/** Durée minimale de l'état « Paiement en cours… », pour que l'étape soit perceptible. */
export const CHECKOUT_MIN_DURATION_MS = 600;

export const TOAST_DURATION_MS = 5000;
