import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import * as store from '../store/proxyStore'
import type { Proxy } from '../store/proxyStore'
import { listRunningContainers } from '../clients/docker'
import { listDevices } from '../clients/tailscale'
import { createRecord, deleteRecord } from '../clients/cloudflare'
import { addRoute, removeRoute } from '../clients/caddy'
import type { CaddyRoute } from '../clients/caddy'

const router = Router()

// ─── Zod schemas ────────────────────────────────────────────────────────────

const upstreamSchema = z.object({
  type: z.enum(['docker', 'tailscale', 'manual']),
  ref: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(80),
})

const createProxySchema = z.object({
  domain: z.string().min(1),
  upstream: upstreamSchema,
  cloudflare: z.object({
    zoneId: z.string().min(1),
  }),
  tls: z.object({
    enabled: z.boolean(),
    email: z.string().email().optional(),
  }),
})

const updateProxySchema = createProxySchema.partial()

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function resolveUpstreamIp(upstream: Proxy['upstream']): Promise<string> {
  if (upstream.type === 'docker') {
    const containers = await listRunningContainers()
    const c = containers.find((c) => c.name === upstream.ref)
    if (!c) throw new Error(`Container not found: ${upstream.ref}`)
    const ip = c.networkIps['bridge'] ?? Object.values(c.networkIps).find(Boolean)
    if (!ip) throw new Error(`No network IP for container: ${upstream.ref}`)
    return ip
  }
  if (upstream.type === 'tailscale') {
    const devices = await listDevices()
    const d = devices.find((d) => d.hostname === upstream.ref)
    if (!d) throw new Error(`Tailscale node not found: ${upstream.ref}`)
    if (!d.ipv4) throw new Error(`No IPv4 for Tailscale node: ${upstream.ref}`)
    return d.ipv4
  }
  return upstream.ref // manual: ref is the host
}

function buildCaddyRoute(id: string, domain: string, ip: string, port: number): CaddyRoute {
  return {
    '@id': `proxy-${id}`,
    match: [{ host: [domain] }],
    handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: `${ip}:${port}` }] }],
    terminal: true,
  }
}

// ─── Startup sync ────────────────────────────────────────────────────────────

export async function syncProxiesToCaddy(): Promise<void> {
  const proxies = await store.readAll()
  for (const proxy of proxies) {
    try {
      const ip = await resolveUpstreamIp(proxy.upstream)
      await addRoute(buildCaddyRoute(proxy.id, proxy.domain, ip, proxy.upstream.port))
      console.log(`[sync] restored proxy ${proxy.id} (${proxy.domain})`)
    } catch (err) {
      console.error(`[sync] skipped proxy ${proxy.id}: ${(err as Error).message}`)
    }
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

router.get('/', async (_req, res) => {
  try {
    const proxies = await store.readAll()
    res.json(proxies)
  } catch (err) {
    res.status(500).json({ error: 'Failed to read proxies', details: err instanceof Error ? err.message : null })
  }
})

router.post('/', async (req, res) => {
  const parsed = createProxySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues })
    return
  }

  const { domain, upstream, cloudflare, tls } = parsed.data

  try {
    const ip = await resolveUpstreamIp(upstream)
    const cfRecord = await createRecord(cloudflare.zoneId, { name: domain, type: 'A', content: ip, proxied: false })
    const id = uuidv4()
    const proxy: Proxy = {
      id,
      domain,
      upstream,
      cloudflare: { zoneId: cloudflare.zoneId, recordId: cfRecord.id },
      tls,
      createdAt: new Date().toISOString(),
    }
    await addRoute(buildCaddyRoute(id, domain, ip, upstream.port))
    await store.add(proxy)
    res.status(201).json(proxy)
  } catch (err) {
    res.status(500).json({ error: 'Failed to create proxy', details: err instanceof Error ? err.message : null })
  }
})

router.put('/:id', async (req, res) => {
  const existing = await store.findById(req.params.id)
  if (!existing) {
    res.status(404).json({ error: `Proxy not found: ${req.params.id}`, details: null })
    return
  }

  const parsed = updateProxySchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.issues })
    return
  }

  const patch = parsed.data
  const updated: Proxy = {
    ...existing,
    ...patch,
    upstream: patch.upstream ? { ...existing.upstream, ...patch.upstream } : existing.upstream,
    cloudflare: patch.cloudflare ? { ...existing.cloudflare, ...patch.cloudflare } : existing.cloudflare,
    tls: patch.tls ? { ...existing.tls, ...patch.tls } : existing.tls,
  }

  const needsRebuild =
    updated.domain !== existing.domain ||
    updated.upstream.type !== existing.upstream.type ||
    updated.upstream.ref !== existing.upstream.ref ||
    updated.upstream.port !== existing.upstream.port ||
    updated.cloudflare.zoneId !== existing.cloudflare.zoneId

  try {
    if (needsRebuild) {
      await removeRoute(existing.id)
      await deleteRecord(existing.cloudflare.zoneId, existing.cloudflare.recordId)
      const ip = await resolveUpstreamIp(updated.upstream)
      const cfRecord = await createRecord(updated.cloudflare.zoneId, {
        name: updated.domain,
        type: 'A',
        content: ip,
        proxied: false,
      })
      updated.cloudflare = { ...updated.cloudflare, recordId: cfRecord.id }
      await addRoute(buildCaddyRoute(updated.id, updated.domain, ip, updated.upstream.port))
    }

    await store.update(existing.id, updated)
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update proxy', details: err instanceof Error ? err.message : null })
  }
})

router.delete('/:id', async (req, res) => {
  const proxy = await store.findById(req.params.id)
  if (!proxy) {
    res.status(404).json({ error: `Proxy not found: ${req.params.id}`, details: null })
    return
  }

  try {
    await removeRoute(proxy.id)
    await deleteRecord(proxy.cloudflare.zoneId, proxy.cloudflare.recordId)
    await store.remove(proxy.id)
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete proxy', details: err instanceof Error ? err.message : null })
  }
})

export default router
