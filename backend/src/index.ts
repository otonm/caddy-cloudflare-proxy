import express from 'express'
import cors from 'cors'
import { tailscaleAuth } from './middleware/tailscaleAuth'

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

// TODO: mount API routers (Steps 2–3)

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('public'))
  app.get('*', (_req, res) => {
    res.sendFile('index.html', { root: 'public' })
  })
}

async function start() {
  const required = ['CF_API_TOKEN', 'TS_API_KEY', 'TS_TAILNET', 'ACME_EMAIL']
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required env var: ${key}`)
    }
  }

  app.listen(PORT, () => {
    console.log(`App listening on port ${PORT}`)
  })

  // Sync proxies to Caddy on startup — implemented in Step 2
  // await syncProxiesToCaddy()
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
