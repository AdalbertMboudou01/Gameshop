/**
 * Limiteur à fenêtre fixe, en mémoire (suffisant pour une instance unique).
 * @param {{ max: number, windowMs: number, now?: () => number }} options
 */
export function createRateLimiter({ max, windowMs, now = Date.now }) {
  /** @type {Map<string, { start: number, count: number }>} */
  const entries = new Map();

  const current = (key) => {
    const entry = entries.get(key);
    if (entry && now() - entry.start <= windowMs) return entry;
    entries.delete(key);
    return null;
  };

  return {
    /** Secondes restantes avant de pouvoir réessayer, 0 si la clé n'est pas bloquée. */
    retryAfterSeconds(key) {
      const entry = current(key);
      if (!entry || entry.count < max) return 0;
      return Math.ceil((entry.start + windowMs - now()) / 1000);
    },
    /** Comptabilise une tentative (échec de connexion, inscription…). */
    record(key) {
      const entry = current(key);
      if (entry) entry.count += 1;
      else entries.set(key, { start: now(), count: 1 });
    },
    reset(key) {
      entries.delete(key);
    },
  };
}
