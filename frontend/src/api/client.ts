import type {
  Proxy,
  CreateProxyInput,
  ContainerInfo,
  TailscaleNode,
  Zone,
  DnsRecord,
  ProxyStatusResult,
  AppConfig,
} from '@/types'

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function getProxies(): Promise<Proxy[]> {
  return apiFetch('/api/proxies')
}

export function createProxy(data: CreateProxyInput): Promise<Proxy> {
  return apiFetch('/api/proxies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export function updateProxy(id: string, data: Partial<CreateProxyInput>): Promise<Proxy> {
  return apiFetch(`/api/proxies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export async function deleteProxy(id: string): Promise<void> {
  await apiFetch(`/api/proxies/${id}`, { method: 'DELETE' })
}

export function getProxyStatus(id: string): Promise<ProxyStatusResult> {
  return apiFetch(`/api/proxies/${id}/status`)
}

export function getDockerContainers(): Promise<ContainerInfo[]> {
  return apiFetch('/api/docker/containers')
}

export function getTailscaleNodes(): Promise<TailscaleNode[]> {
  return apiFetch('/api/tailscale/nodes')
}

export function getCloudflareZones(): Promise<Zone[]> {
  return apiFetch('/api/cloudflare/zones')
}

export function getCloudflareRecords(zoneId: string): Promise<DnsRecord[]> {
  return apiFetch(`/api/cloudflare/${zoneId}/records`)
}

export function getConfig(): Promise<AppConfig> {
  return apiFetch('/api/config')
}
