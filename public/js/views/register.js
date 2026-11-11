import { authPage, passwordToggle, safeReturnPath, withReturn } from '../components/auth-layout.js';
import { alertBox, setBusy, toast } from '../components/feedback.js';
import { formField } from '../components/form-field.js';
import { ACCOUNT_RULES } from '../config.js';
import { api } from '../core/api.js';
import { h } from '../core/dom.js';
import { store } from '../core/store.js';

const { nameMinLength, nameMaxLength, passwordMinLength, passwordMaxLength } = ACCOUNT_RULES;
const PASSWORD_HINT = `${passwordMinLength} caractères minimum, dont une lettre et un chiffre.`;

/**
 * Mêmes règles que le serveur (server/services/account-rules.js), pour guider la saisie
 * avant l'envoi. Le serveur reste la référence : il revalide tout.
 */
function validate({ name, email, password, confirm }, emailInput) {
  const cleanName = name.trim();
  return {
    name: cleanName.length < nameMinLength || cleanName.length > nameMaxLength
      ? `Saisissez votre nom (${nameMinLength} à ${nameMaxLength} caractères).` : '',
    email: !email ? 'Saisissez votre adresse e-mail.'
      : !emailInput.checkValidity() || !/\.[^.\s@]{2,}$/.test(email)
        ? 'Saisissez une adresse e-mail valide, par exemple nom@domaine.fr.' : '',
    password: !password ? 'Choisissez un mot de passe.'
      : password.length < passwordMinLength || password.length > passwordMaxLength
        || !/\p{L}/u.test(password) || !/\d/.test(password)
        ? `Le mot de passe doit contenir au moins ${passwordMinLength} caractères, dont une lettre et un chiffre.` : '',
    confirm: !confirm ? 'Confirmez votre mot de passe.'
      : confirm !== password ? 'Les deux mots de passe ne correspondent pas.' : '',
  };
}

/** @type {import('../core/router.js').View} */
export function renderRegister(main, { query, navigate }) {
  const returnTo = query.get('retour');
  const errorSlot = h('div', { class: 'auth__alert' });

  const fields = {
    name: formField({
      id: 'name', label: 'Nom complet', autocomplete: 'name', placeholder: 'Nom complet', hideLabel: true,
    }),
    email: formField({
      id: 'email', label: 'Adresse e-mail', type: 'email', autocomplete: 'email',
      placeholder: 'Adresse e-mail', hideLabel: true,
    }),
    password: formField({
      id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'new-password',
      placeholder: 'Mot de passe', hideLabel: true, hint: PASSWORD_HINT,
      addon: passwordToggle(() => fields.password.input, 'password'),
    }),
    confirm: formField({
      id: 'confirm', label: 'Confirmer le mot de passe', type: 'password', autocomplete: 'new-password',
      placeholder: 'Confirmer le mot de passe', hideLabel: true,
    }),
  };
  fields.name.input.setAttribute('maxlength', String(nameMaxLength));
  fields.name.input.setAttribute('spellcheck', 'false');

  const submit = h('button', { type: 'submit', class: 'auth__submit' }, 'Créer mon compte');

  async function onSubmit(event) {
    event.preventDefault();
    errorSlot.replaceChildren();
    const values = {
      name: fields.name.input.value,
      email: fields.email.input.value.trim(),
      password: fields.password.input.value,
      confirm: fields.confirm.input.value,
    };

    const errors = validate(values, fields.email.input);
    for (const [key, message] of Object.entries(errors)) fields[key].setError(message);
    const firstInvalid = Object.keys(errors).find((key) => errors[key]);
    if (firstInvalid) return fields[firstInvalid].input.focus();

    const restore = setBusy(submit, 'Création du compte…');
    try {
      const { customer } = await api.register(values.name, values.email, values.password);
      store.setCustomer(customer);
      store.refreshCart();
      navigate(safeReturnPath(returnTo), { replace: true });
      toast(`Bienvenue ${customer.name.split(' ')[0]} ! Votre compte a été créé.`);
    } catch (error) {
      restore();
      // Erreur liée à un champ (e-mail déjà utilisé, mot de passe refusé…) : affichée sous ce champ.
      const field = fields[error.field];
      if (field) {
        field.setError(error.message);
        field.input.focus();
        return;
      }
      errorSlot.replaceChildren(alertBox(error.message, { title: 'Inscription impossible' }));
    }
  }

  const form = h('form', { class: 'auth__form', novalidate: true, 'aria-labelledby': 'register-title', onsubmit: onSubmit },
    errorSlot,
    fields.name.element,
    fields.email.element,
    fields.password.element,
    fields.confirm.element,
    submit,
  );

  main.replaceChildren(authPage(
    { titleId: 'register-title', title: 'Inscription', lead: 'Créez votre compte pour commander en quelques clics.' },
    form,
    h('p', { class: 'auth__register' }, 'Déjà un compte ? ',
      h('a', { class: 'auth__link', href: withReturn('/connexion', returnTo), 'data-link': true }, 'Se connecter')),
  ));
  fields.name.input.focus();
}
