# Step 1 — Foundation & Infrastructure

**Goal:** Runnable skeleton with correct project layout, Docker stack, and auth middleware.

## Files to create

```
caddy-cloudflare-proxy/
├── docker-compose.yml          # caddy + app services
├── Dockerfile                  # multi-stage: build frontend, run backend
├── .env.example                # CF_API_TOKEN, TS_API_KEY, CADDY_ADMIN_URL, ACME_EMAIL
├── .gitignore
├── caddy/
│   └── Caddyfile               # bootstrap config; managed routes injected via API
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Express entry point
│       ├── middleware/
│       │   └── tailscaleAuth.ts  # 100.x.x.x / fd7a:: allowlist → 403 otherwise
│       └── store/
│           └── proxyStore.ts   # read/write proxies.json (atomic write via .tmp rename)
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts          # proxies /api to backend in dev
    └── src/
        └── main.tsx            # bare React app shell
```

## Key implementation details

- **Caddy image:** `ghcr.io/caddybuilds/caddy-cloudflare:latest` — pre-built with the `caddy-dns/cloudflare` plugin. No custom build required.
- **Caddy admin API** exposed on internal Docker network only (port 2019, not published to host).
- **App container** mounts:
  - `/var/run/docker.sock` — for Docker API access
  - `./data/` — volume for `proxies.json` persistence
- **tailscaleAuth middleware:** checks `req.ip` (and `X-Forwarded-For` if trusted proxy is set). Allows `100.x.x.x` and `fd7a::/48`. Returns 403 for all others.
- **proxyStore:** reads/writes a JSON array. Writes are atomic: write to `proxies.tmp.json`, then `fs.rename` to `proxies.json`.

## Environment variables (`.env.example`)

```env
CF_API_TOKEN=       # Cloudflare API token with DNS:Edit permission
TS_API_KEY=         # Tailscale API key
TS_TAILNET=         # Tailscale tailnet name (e.g. example.com or "me")
CADDY_ADMIN_URL=http://caddy:2019
ACME_EMAIL=         # Email for Let's Encrypt certificates
DATA_DIR=/data      # Path inside container for proxies.json
```

## Verification

- `docker compose up` — both containers start without errors
- `curl http://caddy:2019/config/` (from within the stack) returns Caddy's JSON config
- `curl http://localhost:3000/api/health` returns `{ "ok": true }`
- Sending a request from a non-Tailscale IP returns HTTP 403
