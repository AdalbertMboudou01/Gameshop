import { Readable } from 'node:stream';
import { Router } from 'express';

const SAFE_FILENAME_RE = /^[\w-][\w.-]*$/;

/**
 * Relais des images Strapi (/uploads) sous /media/uploads : même origine, images uniquement.
 * @param {{ strapiUrl: string, timeoutMs: number, fetch?: typeof fetch }} options
 */
export function createMediaRouter({ strapiUrl, timeoutMs, fetch: fetchImpl = fetch }) {
  const router = Router();

  router.get('/uploads/:file', async (req, res) => {
    const { file } = req.params;
    if (!SAFE_FILENAME_RE.test(file)) return res.sendStatus(404);

    let upstream;
    try {
      upstream = await fetchImpl(`${strapiUrl}/uploads/${encodeURIComponent(file)}`, {
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return res.sendStatus(502);
    }

    const type = upstream.headers.get('content-type') || '';
    if (!upstream.ok) return res.sendStatus(upstream.status);
    if (!type.startsWith('image/')) return res.sendStatus(415);

    res.set({ 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' });
    Readable.fromWeb(upstream.body).pipe(res);
  });

  return router;
}
