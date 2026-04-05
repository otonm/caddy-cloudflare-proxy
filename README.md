# Caddy Cloudflare Proxy

A self-hosted web UI for managing reverse proxies. It ties together [Caddy](https://caddyserver.com/), Docker, [Tailscale](https://tailscale.com/), and [Cloudflare DNS](https://www.cloudflare.com/) so you can expose local services over HTTPS in a few clicks — with automatic Let's Encrypt certificates via DNS-01 challenge.

## Prerequisites

- Docker + Docker Compose
- A Cloudflare account with at least one zone
- A Cloudflare API token with **Zone:Read** and **DNS:Edit** permissions
- A Tailscale account + API key (used for both node discovery and restricting UI access to Tailscale peers)

## Setup

```sh
cp .env.example .env
# edit .env with your credentials
docker compose up -d
```

Only `docker-compose.yml` and `.env` are needed — the Caddyfile is embedded in the compose file and data is stored in Docker named volumes.

Open `http://<your-tailscale-ip>:3000` in a browser.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CF_API_TOKEN` | yes | — | Cloudflare API token (Zone:Read + DNS:Edit) |
| `TS_API_KEY` | yes | — | Tailscale API key |
| `TS_TAILNET` | yes | — | Tailscale tailnet name (e.g. `me` or `example.com`) |
| `ACME_EMAIL` | yes | — | Email for Let's Encrypt registration |
| `CADDY_ADMIN_URL` | no | `http://caddy:2019` | Caddy admin API URL |
| `APP_PORT` | no | `3000` | Host port the UI is exposed on |
| `DISABLE_AUTH` | no | `false` | Set to `true` to skip Tailscale IP check (dev only) |

## Architecture

```
Browser (Tailscale peer)
        │
        ▼
  ┌─────────────┐
  │  app :3000  │  React UI + Express API
  └──────┬──────┘
         │ admin API (HTTP)
         ▼
  ┌─────────────┐        ┌───────────────────┐
  │  caddy :80  │        │  Cloudflare DNS   │
  │       :443  │        │  (A records)      │
  └─────────────┘        └───────────────────┘
         │
  routes added dynamically via Caddy admin API
         │
  ┌──────┴──────────────────────┐
  │  upstream services          │
  │  - Docker containers        │
  │  - Tailscale nodes          │
  │  - Manual host/IP           │
  └─────────────────────────────┘
```

The app container also reads the local Docker socket (`/var/run/docker.sock`) to list running containers, and calls the Tailscale API to list Tailscale devices.

## How it works

When you add a proxy:

1. The app resolves the upstream IP (Docker container IP, Tailscale IPv4, or manual host).
2. An A record is created in Cloudflare DNS pointing your domain to that IP.
3. A route is added to Caddy via its admin API (`POST /config/apps/http/servers/proxy/routes`).
4. Caddy automatically obtains a TLS certificate using DNS-01 challenge (no port 80 exposure needed).

Proxy config is persisted to `./data/app/proxies.json`. On restart, the app re-syncs all routes to Caddy so nothing is lost.

Deleting a proxy removes the Caddy route and the Cloudflare DNS record.

## Development

```sh
# Terminal 1 — backend (auto-reloads)
cd backend && npm run dev

# Terminal 2 — frontend (Vite dev server with /api proxy to localhost:3000)
cd frontend && npm run dev
```

Set `DISABLE_AUTH=true` in `.env` when running outside Tailscale during development.
