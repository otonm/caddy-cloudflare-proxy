import cors from 'cors';
import express from 'express';
import cloudflareRouter from './routes/cloudflare';
import dockerRouter from './routes/docker';
import proxiesRouter, { syncProxiesToCaddy } from './routes/proxies';
import systemRouter from './routes/system';
import tailscaleRouter from './routes/tailscale';

const app = express();
const PORT = parseInt(process.env.APP_PORT ?? '3000', 10);

app.use(cors());
app.use(express.json());

// Health endpoint — always accessible (no auth), used by Docker healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/config', (_req, res) => {
  res.json({ acmeEmail: process.env.ACME_EMAIL ?? '' });
});

app.use('/api/proxies', proxiesRouter);
app.use('/api/docker', dockerRouter);
app.use('/api/tailscale', tailscaleRouter);
app.use('/api/cloudflare', cloudflareRouter);
app.use('/api/system', systemRouter);

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('public'));
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });
}

async function start() {
  const vars = ['CF_API_TOKEN', 'TS_API_KEY', 'TS_TAILNET'];
  const missing = vars.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error('[startup] Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  console.log(
    '[startup] Config OK — TS_TAILNET =',
    process.env.TS_TAILNET,
    process.env.ACME_EMAIL ? `, ACME_EMAIL = ${process.env.ACME_EMAIL}` : '(ACME_EMAIL not set)',
  );

  app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`);
  });

  await syncProxiesToCaddy();
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
