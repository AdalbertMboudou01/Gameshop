import { authPage, passwordToggle, safeReturnPath, withReturn } from '../components/auth-layout.js';
import { alertBox, setBusy } from '../components/feedback.js';
import { formField } from '../components/form-field.js';
import { api } from '../core/api.js';
import { h } from '../core/dom.js';
import { store } from '../core/store.js';

const FORGOT_PASSWORD_INFO = 'La réinitialisation du mot de passe n’est pas disponible dans cette boutique de démonstration. Créez un nouveau compte ou utilisez le compte de démonstration.';

/** @param {string} email @param {string} password @param {HTMLInputElement} emailInput */
function validate(email, password, emailInput) {
  return {
    email: !email ? 'Saisissez votre adresse e-mail.'
      : !emailInput.checkValidity() ? 'Saisissez une adresse e-mail valide, par exemple nom@domaine.fr.' : '',
    password: password ? '' : 'Saisissez votre mot de passe.',
  };
}

/** @type {import('../core/router.js').View} */
export function renderLogin(main, { query, navigate, isCurrent }) {
  const returnTo = query.get('retour');
  const errorSlot = h('div', { class: 'auth__alert' });
  const infoSlot = h('p', { class: 'auth__info', role: 'status' });

  const email = formField({
    id: 'email', label: 'Adresse e-mail', type: 'email', autocomplete: 'username',
    placeholder: 'Adresse e-mail', hideLabel: true,
  });
  const password = formField({
    id: 'password', label: 'Mot de passe', type: 'password', autocomplete: 'current-password',
    placeholder: 'Mot de passe', hideLabel: true, addon: passwordToggle(() => password.input, 'password'),
  });
  const remember = h('input', { type: 'checkbox', id: 'remember', name: 'remember', class: 'auth__checkbox' });
  const submit = h('button', { type: 'submit', class: 'auth__submit' }, 'Se connecter');

  const showError = (title, message) => errorSlot.replaceChildren(alertBox(message, { title }));
  const showInfo = (message) => { infoSlot.textContent = message; };

  async function onSubmit(event) {
    event.preventDefault();
    errorSlot.replaceChildren();
    showInfo('');
    const emailValue = email.input.value.trim();
    const passwordValue = password.input.value;

    const errors = validate(emailValue, passwordValue, email.input);
    email.setError(errors.email);
    password.setError(errors.password);
    if (errors.email) return email.input.focus();
    if (errors.password) return password.input.focus();

    const restore = setBusy(submit, 'Connexion…');
    try {
      const { customer } = await api.login(emailValue, passwordValue, remember.checked);
      store.setCustomer(customer);
      store.refreshCart();
      navigate(safeReturnPath(returnTo), { replace: true });
    } catch (error) {
      restore();
      if (error.code !== 'INVALID_CREDENTIALS') return showError('Connexion impossible', error.message);
      showError('Identifiants incorrects', 'Vérifiez votre adresse e-mail et votre mot de passe, puis réessayez.');
      password.input.value = '';
      email.markInvalid();
      password.markInvalid();
      password.input.focus();
    }
  }

  const form = h('form', { class: 'auth__form', novalidate: true, 'aria-labelledby': 'login-title', onsubmit: onSubmit },
    errorSlot,
    email.element,
    password.element,
    h('div', { class: 'auth__options' },
      h('label', { class: 'auth__remember', for: 'remember' }, remember, 'Se souvenir de moi'),
      h('button', { type: 'button', class: 'auth__link', onclick: () => showInfo(FORGOT_PASSWORD_INFO) }, 'Mot de passe oublié ?'),
    ),
    submit,
  );
  const demoSlot = h('div');

  main.replaceChildren(authPage({ titleId: 'login-title', title: 'Connexion' },
    form,
    h('p', { class: 'auth__register' }, 'Pas encore de compte ? ',
      h('a', { class: 'auth__link', href: withReturn('/inscription', returnTo), 'data-link': true }, 'Créer un compte')),
    infoSlot,
    demoSlot,
  ));
  email.input.focus();

  // Raccourci discret vers le compte de démonstration (masquable avec SHOW_DEMO_ACCOUNT=false).
  api.publicConfig()
    .then(({ demoAccount }) => {
      if (!demoAccount || !isCurrent()) return;
      demoSlot.replaceWith(h('button', {
        type: 'button',
        class: 'auth__demo',
        onclick: () => {
          email.input.value = demoAccount.email;
          password.input.value = demoAccount.password;
          email.setError('');
          password.setError('');
          errorSlot.replaceChildren();
          showInfo(`Compte de démonstration : ${demoAccount.email}`);
          submit.focus();
        },
      }, 'Utiliser le compte de démonstration'));
    })
    .catch(() => {});
}
