const BASE_URL = process.env.CADDY_ADMIN_URL ?? 'http://caddy:2019'
const SERVER_NAME = 'proxy'

export interface CaddyRoute {
  '@id': string
  match: [{ host: string[] }]
  handle: [{ handler: 'reverse_proxy'; upstreams: [{ dial: string }] }]
  terminal: boolean
}

async function caddyFetch(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, options)
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Caddy admin API ${options?.method ?? 'GET'} ${path} → ${res.status}: ${body}`)
  }
  return res
}

export async function getConfig(): Promise<unknown> {
  const res = await caddyFetch('/config/')
  return res.json()
}

export async function getRoutes(): Promise<CaddyRoute[]> {
  const config = (await getConfig()) as Record<string, unknown>
  const routes =
    (config as any)?.apps?.http?.servers?.[SERVER_NAME]?.routes
  return Array.isArray(routes) ? (routes as CaddyRoute[]) : []
}

export async function addRoute(route: CaddyRoute): Promise<void> {
  // Try to append to the existing routes array
  const appendRes = await fetch(
    `${BASE_URL}/config/apps/http/servers/${SERVER_NAME}/routes/...`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(route),
    }
  )

  if (appendRes.ok) return

  // If the server/routes path doesn't exist yet, create it with a PUT
  const createRes = await fetch(
    `${BASE_URL}/config/apps/http/servers/${SERVER_NAME}/routes`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([route]),
    }
  )

  if (!createRes.ok) {
    const body = await createRes.text()
    throw new Error(`Caddy addRoute failed: ${createRes.status}: ${body}`)
  }
}

export async function removeRoute(routeId: string): Promise<void> {
  await caddyFetch(`/id/${encodeURIComponent(routeId)}`, { method: 'DELETE' })
}
