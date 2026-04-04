# Step 4 — Frontend UI

**Goal:** Complete React UI with a proxy management table and add/edit dialog.

## Tech stack

- React 18 + Vite + TypeScript
- shadcn/ui + Tailwind CSS (component library)
- `@tanstack/react-query` — data fetching and cache invalidation
- `react-hook-form` + `zod` — form state and validation

## Component tree

```
App
└── Layout (header + main)
    └── ProxyTable
        ├── ProxyRow × N
        │   ├── Domain badge
        │   ├── Upstream label (type + ref + port)
        │   ├── Status badge (active / pending / error)
        │   └── Actions (Edit button, Delete button with confirm dialog)
        ├── EmptyState (shown when no proxies)
        └── AddProxyButton → opens AddProxyDialog

AddProxyDialog / EditProxyDialog (shared form)
├── DomainInput              text field, validates as hostname
├── UpstreamPicker           Tabs: Docker | Tailscale | Manual
│   ├── [Docker tab]
│   │   └── ContainerSelect  Select populated from GET /api/docker/containers
│   │       └── PortInput    number field (pre-filled from container's exposed ports)
│   ├── [Tailscale tab]
│   │   └── NodeSelect       Select populated from GET /api/tailscale/nodes
│   │       └── PortInput    number field
│   └── [Manual tab]
│       ├── HostInput        text field
│       └── PortInput        number field
├── CloudflarePicker
│   ├── ZoneSelect           Select populated from GET /api/cloudflare/zones
│   └── RecordChoice         Radio: "Create new record" | "Use existing"
│       └── [if existing]
│           └── RecordSelect Select populated from GET /api/cloudflare/:zoneId/records
└── TLSSection
    ├── TLSToggle            Switch
    └── [if enabled] EmailInput  text field (ACME email)
```

## File structure

```
frontend/src/
├── main.tsx
├── App.tsx
├── api/
│   └── client.ts            # typed fetch wrappers for all API routes
├── components/
│   ├── ProxyTable.tsx
│   ├── ProxyRow.tsx
│   ├── ProxyDialog.tsx      # shared add/edit form
│   ├── UpstreamPicker.tsx
│   ├── CloudflarePicker.tsx
│   └── TLSSection.tsx
├── hooks/
│   ├── useProxies.ts        # useQuery for GET /api/proxies
│   ├── useDockerContainers.ts
│   ├── useTailscaleNodes.ts
│   └── useCloudflare.ts     # zones + records
└── types.ts                 # shared TypeScript interfaces (mirrors backend model)
```

## UX details

- **Status badge** — derived from proxy state:
  - `active` (green) — Caddy route exists and is healthy
  - `pending` (yellow) — just created, waiting for ACME cert issuance
  - `error` (red) — last operation failed
- **Delete confirmation** — inline `AlertDialog` (shadcn): "Delete app.example.com? This will remove the Caddy route and Cloudflare DNS record."
- **Dialog submit button** — shows spinner while mutation is in flight; disabled during loading
- **Dropdowns** — show loading skeleton while fetching; show error state if fetch failed
- **Cache invalidation** — after create/update/delete, invalidate `['proxies']` query to refetch table

## Vite dev proxy config (`vite.config.ts`)

```ts
server: {
  proxy: {
    '/api': 'http://localhost:3000'
  }
}
```

## Verification

```bash
cd frontend && npm run dev
# → http://localhost:5173 shows the proxy table
# → "Add Proxy" button opens dialog
# → All dropdowns (containers, nodes, zones) populate with real API data
# → Submitting incomplete form shows inline validation errors
# → Submitting valid form creates proxy and refreshes table
```
