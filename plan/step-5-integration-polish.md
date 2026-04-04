# Step 5 — Integration, Error Handling & Polish

**Goal:** Everything works end-to-end in docker-compose; the app is production-ready.

## Tasks

### 1. Error handling & toasts
- **Backend:** All route handlers wrapped in `try/catch`. Errors returned as `{ error: string, details: any }` with appropriate HTTP status codes (400/404/502/500).
- **Frontend:** `@tanstack/react-query` `onError` callbacks trigger `sonner` toast notifications. Errors from mutations (create/update/delete) show the backend `error` message.
- Distinguish user errors (400) from upstream failures (502 — Caddy/Cloudflare unreachable).

### 2. Loading & skeleton states
- **Table:** Show skeleton rows while initial `GET /api/proxies` is in flight.
- **Dialog dropdowns:** Show `<Skeleton>` items while fetching containers/nodes/zones.
- **Submit button:** Disabled + spinner during mutation.

### 3. Optimistic UI
- **Delete:** Remove row immediately from React Query cache; roll back on error.
- **Create:** Optionally show a temporary "pending" row while mutation is in flight.

### 4. Environment variable validation
Validate at backend startup (`src/index.ts`). Throw with a clear message if required vars are missing:

```ts
const required = ['CF_API_TOKEN', 'TS_API_KEY', 'TS_TAILNET', 'ACME_EMAIL']
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required env var: ${key}`)
}
```

### 5. Caddy TLS global config

Update `caddy/Caddyfile` with global ACME options:

```
{
  acme_dns cloudflare {env.CF_API_TOKEN}
  email {env.ACME_EMAIL}
}
```

Caddy config persistence: mount `./data/caddy/` as `/data` in the Caddy container so that ACME certs and the running config survive restarts. The management app writes routes via the admin API, which Caddy persists to `/data/caddy/autosave.json`.

### 6. Docker healthchecks

```yaml
# docker-compose.yml
caddy:
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:2019/config/"]
    interval: 10s
    timeout: 5s
    retries: 3

app:
  healthcheck:
    test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/api/health"]
    interval: 10s
    timeout: 5s
    retries: 3
  depends_on:
    caddy:
      condition: service_healthy
```

### 7. Multi-stage Dockerfile

```dockerfile
# Stage 1: build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: backend runtime
FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/ ./
RUN npm run build
COPY --from=frontend-build /app/frontend/dist ./public
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

Backend serves the built frontend as static files from `/public`.

### 8. README

Sections:
- Overview + screenshot
- Prerequisites (Docker, Cloudflare API token with DNS:Edit, Tailscale API key)
- Setup: copy `.env.example` → `.env`, fill values, `docker compose up`
- Environment variables table
- How it works (architecture diagram — ASCII)

## End-to-end verification checklist

```
[ ] docker compose up  →  both services healthy
[ ] Open http://<tailscale-ip>:3000 in browser
[ ] Proxy table loads (empty state shown)
[ ] Click "Add Proxy"
[ ] Docker tab: containers list populates
[ ] Tailscale tab: nodes list populates
[ ] Cloudflare: zone dropdown populates; selecting zone loads records
[ ] Fill form, submit
[ ] → Cloudflare DNS record created (verify in CF dashboard)
[ ] → Caddy route appears in GET http://caddy:2019/config/apps/http/servers/proxy/routes
[ ] → Proxy row appears in table with "pending" badge
[ ] → After ACME cert issued, domain serves HTTPS (may take ~30s)
[ ] Click Delete → row removed, DNS record deleted, Caddy route removed
[ ] Access from non-Tailscale IP → 403
```
