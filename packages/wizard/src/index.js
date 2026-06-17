import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const publicDir = join(__dirname, '../public');

export async function startWizard({ port = 7700, onSubmit } = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(publicDir));

  app.post('/api/wizard/submit', async (req, res) => {
    try {
      if (typeof onSubmit === 'function') {
        const result = await onSubmit(req.body, { app });
        return res.json({ ok: true, ...result });
      }
      console.log('[wizard] received config (no runtime handler wired):', JSON.stringify(req.body, null, 2));
      res.json({
        ok: true,
        message: 'Configuration received. No runtime handler is wired — pass `onSubmit` to startWizard() to act on it.',
        received: req.body,
      });
    } catch (e) {
      console.error('[wizard] onSubmit error:', e);
      res.status(500).json({ ok: false, message: e.message, stack: e.stack });
    }
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`[codenanny wizard] open http://localhost:${port}`);
      resolve({ server, port, app });
    });
  });
}
