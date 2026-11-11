/**
 * Routeur minimal basé sur l'API History.
 *
 * Une vue est une fonction `(outlet, context) => cleanup?` (éventuellement asynchrone) ;
 * le `cleanup` renvoyé est appelé avant l'affichage de la page suivante.
 *
 * @typedef {{ params: string[], query: URLSearchParams, navigate: Navigate, isCurrent: () => boolean }} ViewContext
 * @typedef {(outlet: HTMLElement, context: ViewContext) => void | (() => void) | Promise<void | (() => void)>} View
 * @typedef {{ pattern: RegExp, view: View, title: string, public?: boolean, nav?: string }} Route
 * @typedef {(path: string, options?: { replace?: boolean }) => void} Navigate
 */

/**
 * @param {{
 *   routes: Route[],
 *   notFound: View,
 *   outlet: HTMLElement,
 *   guard?: (route: Route | undefined, url: URL) => string | null,
 *   beforeRender?: (route: Route | undefined, url: URL) => void,
 * }} options
 */
export function createRouter({ routes, notFound, outlet, guard = () => null, beforeRender = () => {} }) {
  let renderId = 0;
  let cleanup = null;
  let firstRender = true;

  /** @type {Navigate} */
  function navigate(path, { replace = false } = {}) {
    if (replace) history.replaceState(null, '', path);
    else history.pushState(null, '', path);
    render();
  }

  function match(pathname) {
    for (const route of routes) {
      const result = pathname.match(route.pattern);
      if (result) return { route, params: result.slice(1) };
    }
    return { route: undefined, params: [] };
  }

  async function render() {
    const id = ++renderId;
    const url = new URL(location.href);
    const { route, params } = match(url.pathname);

    const redirect = guard(route, url);
    if (redirect) return navigate(redirect, { replace: true });

    cleanup?.();
    cleanup = null;
    beforeRender(route, url);
    outlet.replaceChildren();
    if (!firstRender) window.scrollTo({ top: 0 });

    const result = await (route?.view ?? notFound)(outlet, {
      params,
      query: url.searchParams,
      navigate,
      isCurrent: () => id === renderId,
    });
    if (id !== renderId) {
      if (typeof result === 'function') result();
      return;
    }
    cleanup = typeof result === 'function' ? result : null;

    // Après une navigation, le focus va sur le titre de la page (repère pour clavier et lecteurs d'écran).
    if (!firstRender) {
      const heading = outlet.querySelector('h1');
      heading?.setAttribute('tabindex', '-1');
      heading?.focus({ preventScroll: true });
    }
    firstRender = false;
  }

  /** Intercepte les liens internes marqués `data-link` (clic simple uniquement). */
  function onLinkClick(event) {
    const link = event.target.closest('a[data-link]');
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    if (url.pathname + url.search !== location.pathname + location.search) navigate(url.pathname + url.search);
  }

  return {
    navigate,
    start() {
      document.addEventListener('click', onLinkClick);
      window.addEventListener('popstate', render);
      return render();
    },
  };
}
