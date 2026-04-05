import express from 'express'
import cors from 'cors'
import { tailscaleAuth } from './middleware/tailscaleAuth'
import proxiesRouter, { syncProxiesToCaddy } from './routes/proxies'
import dockerRouter from './routes/docker'
import tailscaleRouter from './routes/tailscale'
import cloudflareRouter from './routes/cloudflare'

const app = express()
const PORT = parseInt(process.env.APP_PORT ?? '3000', 10)

app.use(cors())
app.use(express.json())

// Health endpoint — always accessible (no auth), used by Docker healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// Apply Tailscale IP auth to all subsequent routes
app.use(tailscaleAuth)

app.get('/api/config', (_req, res) => {
  res.json({ acmeEmail: process.env.ACME_EMAIL ?? '' })
})

app.use('/api/proxies', proxiesRouter)
app.use('/api/docker', dockerRouter)
app.use('/api/tailscale', tailscaleRouter)
app.use('/api/cloudflare', cloudflareRouter)

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('public'))
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: 'public' })
  })
}

async function start() {
  const vars = ['CF_API_TOKEN', 'TS_API_KEY', 'TS_TAILNET', 'ACME_EMAIL']
  const missing = vars.filter((k) => !process.env[k])
  if (missing.length) {
    console.error('[startup] Missing required environment variables:', missing.join(', '))
    process.exit(1)
  }
  console.log('[startup] Config OK — TS_TAILNET =', process.env.TS_TAILNET, ', ACME_EMAIL =', process.env.ACME_EMAIL)

  app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
  })

  await syncProxiesToCaddy()
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
