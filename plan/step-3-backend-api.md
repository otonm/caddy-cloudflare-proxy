# Step 3 — Backend REST API

**Goal:** Full CRUD API for proxies, plus read-only list endpoints that feed UI dropdowns.

## Files to create

```
backend/src/routes/
├── proxies.ts       # CRUD for proxy configurations
├── docker.ts        # GET /api/docker/containers
├── tailscale.ts     # GET /api/tailscale/nodes
└── cloudflare.ts    # GET /api/cloudflare/zones, /api/cloudflare/:zoneId/records
```

## API routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/proxies` | List all proxies from store |
| `POST` | `/api/proxies` | Create proxy (DNS + Caddy route + store) |
| `PUT` | `/api/proxies/:id` | Update proxy (rebuild DNS record + Caddy route) |
| `DELETE` | `/api/proxies/:id` | Remove proxy (delete DNS + Caddy route + store) |
| `GET` | `/api/docker/containers` | List running Docker containers |
| `GET` | `/api/tailscale/nodes` | List Tailscale devices |
| `GET` | `/api/cloudflare/zones` | List Cloudflare zones |
| `GET` | `/api/cloudflare/:zoneId/records` | List DNS records for a zone |

## Proxy data model

```ts
interface Proxy {
  id: string              // uuid v4
  domain: string          // e.g. "app.example.com"
  upstream: {
    type: 'docker' | 'tailscale' | 'manual'
    ref: string           // container name, Tailscale hostname, or "host:port"
    port: number
  }
  cloudflare: {
    zoneId: string
    recordId: string      // CF DNS record ID (populated on create)
  }
  tls: {
    enabled: boolean
    email: string         // ACME registration email
  }
  createdAt: string       // ISO 8601
}
```

## POST /api/proxies — create flow

1. Validate request body with Zod schema
2. Resolve upstream IP:
   - `docker` → container's first bridge network IP (via Docker client)
   - `tailscale` → node's `ipv4` (via Tailscale client)
   - `manual` → use `ref` as-is
3. Create Cloudflare DNS A record: `domain → upstream IP` (proxied: false)
4. Build Caddy route JSON (with `@id: "proxy-{id}"`)
5. `addRoute()` via Caddy client
6. Save proxy to `proxies.json` store
7. Return `201 Created` with full proxy object

## PUT /api/proxies/:id — update flow

1. Load existing proxy from store
2. If `domain`, `upstream`, or `cloudflare.zoneId` changed:
   - Delete old Cloudflare DNS record
   - Delete old Caddy route
   - Re-run create flow with new values
3. Otherwise patch in place
4. Return `200 OK`

## DELETE /api/proxies/:id — delete flow

1. Load proxy from store (return 404 if not found)
2. `removeRoute(proxy.id)` via Caddy client
3. `deleteRecord(zoneId, recordId)` via Cloudflare client
4. Remove from `proxies.json` store
5. Return `204 No Content`

## Validation (Zod schemas)

```ts
const createProxySchema = z.object({
  domain: z.string().min(1),
  upstream: z.object({
    type: z.enum(['docker', 'tailscale', 'manual']),
    ref: z.string().min(1),
    port: z.number().int().min(1).max(65535),
  }),
  cloudflare: z.object({
    zoneId: z.string().min(1),
  }),
  tls: z.object({
    enabled: z.boolean(),
    email: z.string().email().optional(),
  }),
})
```

## Error response format

```ts
{ "error": "Human-readable message", "details": <original error or null> }
```

## Verification

```bash
# Create a proxy
curl -X POST http://localhost:3000/api/proxies \
  -H 'Content-Type: application/json' \
  -d '{"domain":"test.example.com","upstream":{"type":"manual","ref":"localhost","port":8080},...}'

# Verify in Caddy
curl http://caddy:2019/config/apps/http/servers/proxy/routes

# Verify in Cloudflare dashboard — DNS record for test.example.com should appear
```
