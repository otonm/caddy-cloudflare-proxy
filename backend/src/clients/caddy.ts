const BASE_URL = process.env.CADDY_ADMIN_URL ?? 'http://caddy:2019';
const SERVER_NAME = 'proxy';
const ADMIN_ORIGIN = new URL(BASE_URL).origin;
const ADMIN_HEADERS = { 'Content-Type': 'application/json', Origin: ADMIN_ORIGIN };

export interface CaddyRoute {
  '@id': string;
  match: [{ host: string[] }];
  handle: [{ handler: 'reverse_proxy'; upstreams: [{ dial: string }] }];
  terminal: boolean;
}

export interface CaddyTLSPolicy {
  subjects: string[];
  issuers: [
    {
      module: 'acme';
      email: string;
      challenges: { dns: { provider: { name: 'cloudflare'; api_token: string } } };
    },
  ];
}

async function caddyFetch(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...ADMIN_HEADERS, ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Caddy admin API ${options?.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }
  return res;
}

export async function getConfig(): Promise<unknown> {
  const res = await caddyFetch('/config/');
  return res.json();
}

export async function getRoutes(): Promise<CaddyRoute[]> {
  const config = (await getConfig()) as Record<string, unknown>;
  const routes = (config as any)?.apps?.http?.servers?.[SERVER_NAME]?.routes;
  return Array.isArray(routes) ? (routes as CaddyRoute[]) : [];
}

export async function addRoute(route: CaddyRoute): Promise<void> {
  // Try to append to the existing routes array
  const appendRes = await fetch(`${BASE_URL}/config/apps/http/servers/${SERVER_NAME}/routes/...`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify(route),
  });

  if (appendRes.ok) return;

  // If the server/routes path doesn't exist yet, create it with a PUT
  const createRes = await fetch(`${BASE_URL}/config/apps/http/servers/${SERVER_NAME}/routes`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
    body: JSON.stringify([route]),
  });

  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Caddy addRoute failed: ${createRes.status}: ${body}`);
  }
}

export async function removeRoute(routeId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/id/${encodeURIComponent(routeId)}`, {
    method: 'DELETE',
    headers: ADMIN_HEADERS,
  });
  if (res.status === 404 || res.status === 400) return; // already gone
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Caddy admin API DELETE /id/${routeId} → ${res.status}: ${body}`);
  }
}

// ─── TLS automation policies ─────────────────────────────────────────────────

async function getAutomationPolicies(): Promise<CaddyTLSPolicy[]> {
  const res = await fetch(`${BASE_URL}/config/apps/tls/automation/policies`, { headers: ADMIN_HEADERS });
  if (res.status === 404 || res.status === 400) return []; // 400 = parent path not yet configured
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Caddy GET policies → ${res.status}: ${body}`);
  }
  const data = await res.json();
  return Array.isArray(data) ? (data as CaddyTLSPolicy[]) : [];
}

async function findPolicyIndex(domain: string): Promise<number> {
  const policies = await getAutomationPolicies();
  return policies.findIndex((p) => p.subjects?.includes(domain));
}

export async function upsertTLSPolicy(domain: string, email: string, cfToken: string): Promise<void> {
  const policy: CaddyTLSPolicy = {
    subjects: [domain],
    issuers: [{ module: 'acme', email, challenges: { dns: { provider: { name: 'cloudflare', api_token: cfToken } } } }],
  };
  const index = await findPolicyIndex(domain);
  if (index >= 0) {
    await caddyFetch(`/config/apps/tls/automation/policies/${index}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(policy),
    });
    return;
  }
  // Append to existing array; fall back to creating it if the path doesn't exist yet
  const appendRes = await fetch(`${BASE_URL}/config/apps/tls/automation/policies/...`, {
    method: 'POST',
    headers: ADMIN_HEADERS,
    body: JSON.stringify(policy),
  });
  if (appendRes.ok) return;
  const createRes = await fetch(`${BASE_URL}/config/apps/tls/automation/policies`, {
    method: 'PUT',
    headers: ADMIN_HEADERS,
    body: JSON.stringify([policy]),
  });
  if (!createRes.ok) {
    const body = await createRes.text();
    throw new Error(`Caddy upsertTLSPolicy failed: ${createRes.status}: ${body}`);
  }
}

export async function removeTLSPolicy(domain: string): Promise<void> {
  const index = await findPolicyIndex(domain);
  if (index < 0) return;
  const path = `/config/apps/tls/automation/policies/${index}`;
  const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers: ADMIN_HEADERS });
  if (res.status === 404 || res.status === 400) return; // already gone
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Caddy admin API DELETE ${path} → ${res.status}: ${body}`);
  }
}
