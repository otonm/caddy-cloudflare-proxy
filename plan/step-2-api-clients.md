# Step 2 — External API Clients

**Goal:** Isolated, typed clients for all four external systems: Docker, Tailscale, Cloudflare, and Caddy.

## Files to create

```
backend/src/clients/
├── docker.ts        # list running containers via Docker socket
├── tailscale.ts     # list devices via Tailscale REST API
├── cloudflare.ts    # list zones, list/create/delete DNS records
└── caddy.ts         # read/add/remove routes via Caddy admin API
```

## Implementation details

### docker.ts
- **Package:** `dockerode` (accesses `/var/run/docker.sock`)
- **Returns:**
  ```ts
  interface ContainerInfo {
    id: string
    name: string        // stripped leading "/"
    image: string
    ports: { internal: number; external?: number }[]
    networks: string[]
    status: string      // "running" | "exited" etc.
  }
  ```
- Only returns running containers (`filters: { status: ['running'] }`)

### tailscale.ts
- **Endpoint:** `GET https://api.tailscale.com/api/v2/tailnet/{TS_TAILNET}/devices`
- **Auth:** `Authorization: Bearer {TS_API_KEY}`
- **Returns:**
  ```ts
  interface TailscaleNode {
    id: string
    hostname: string
    ipv4: string        // first address in 100.x.x.x range
    ipv6: string        // first fd7a:: address
    os: string
    online: boolean
  }
  ```

### cloudflare.ts
- **Package:** `cloudflare` (official Cloudflare SDK)
- **Auth:** `CF_API_TOKEN` env var
- **Operations:**
  ```ts
  listZones(): Promise<Zone[]>
  listRecords(zoneId: string): Promise<DnsRecord[]>
  createRecord(zoneId: string, record: { name: string; type: 'A' | 'CNAME'; content: string; proxied: boolean }): Promise<DnsRecord>
  deleteRecord(zoneId: string, recordId: string): Promise<void>
  ```

### caddy.ts
- **Base URL:** `CADDY_ADMIN_URL` env var (default: `http://caddy:2019`)
- **Operations:**
  ```ts
  getConfig(): Promise<CaddyConfig>
  getRoutes(): Promise<CaddyRoute[]>
  addRoute(route: CaddyRoute): Promise<void>
  removeRoute(routeId: string): Promise<void>
  ```
- Route format (Caddy JSON config):
  ```json
  {
    "@id": "proxy-{uuid}",
    "match": [{ "host": ["app.example.com"] }],
    "handle": [{
      "handler": "reverse_proxy",
      "upstreams": [{ "dial": "container:8080" }]
    }],
    "terminal": true
  }
  ```
- Use `@id` field to identify routes for deletion

## Verification

- Unit tests with `vitest` + mocked HTTP responses for each client
- Manual integration check:
  - Docker client lists containers when socket is mounted
  - Tailscale client returns devices with valid API key
  - Cloudflare client returns zones with valid API token
  - Caddy client reads config from running Caddy container
