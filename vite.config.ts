import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleCoach } from './server/coach';

/** Serves POST /api/coach during `npm run dev`, reading GROQ_API_KEY from .env.local (never exposed to the browser). */
function coachApi(env: Record<string, string>): Plugin {
  return {
    name: 'lynq-coach-api',
    configureServer(server) {
      server.middlewares.use('/api/coach', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let raw = '';
        req.on('data', chunk => { raw += chunk; if (raw.length > 200_000) req.destroy(); });
        req.on('end', async () => {
          let body: unknown = null;
          try { body = JSON.parse(raw); } catch { /* handled as bad request */ }
          const result = await handleCoach(body, { GROQ_API_KEY: env.GROQ_API_KEY, GROQ_MODEL: env.GROQ_MODEL }, req.socket.remoteAddress ?? 'local');
          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Empty prefix loads every variable from .env files for server-side use only; Vite still only
  // exposes VITE_-prefixed variables to browser code.
  const env = loadEnv(mode, '.', '');
  return { plugins: [react(), coachApi(env)] };
});
