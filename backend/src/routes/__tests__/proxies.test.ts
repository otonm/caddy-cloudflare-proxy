import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../store/proxyStore', () => ({
  readAll: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  findById: vi.fn(),
}))

vi.mock('../../clients/docker', () => ({
  listRunningContainers: vi.fn(),
}))

vi.mock('../../clients/tailscale', () => ({
  listDevices: vi.fn(),
}))

vi.mock('../../clients/cloudflare', () => ({
  createRecord: vi.fn(),
  deleteRecord: vi.fn(),
}))

vi.mock('../../clients/caddy', () => ({
  addRoute: vi.fn(),
  removeRoute: vi.fn(),
}))

import * as store from '../../store/proxyStore'
import { listRunningContainers } from '../../clients/docker'
import { listDevices } from '../../clients/tailscale'
import { createRecord, deleteRecord } from '../../clients/cloudflare'
import { addRoute, removeRoute } from '../../clients/caddy'
import proxiesRouter from '../proxies'

const app = express()
app.use(express.json())
app.use('/api/proxies', proxiesRouter)

const mockReadAll = vi.mocked(store.readAll)
const mockAdd = vi.mocked(store.add)
const mockUpdate = vi.mocked(store.update)
const mockRemove = vi.mocked(store.remove)
const mockFindById = vi.mocked(store.findById)
const mockListContainers = vi.mocked(listRunningContainers)
const mockListDevices = vi.mocked(listDevices)
const mockCreateRecord = vi.mocked(createRecord)
const mockDeleteRecord = vi.mocked(deleteRecord)
const mockAddRoute = vi.mocked(addRoute)
const mockRemoveRoute = vi.mocked(removeRoute)

const baseProxy = {
  id: 'test-id',
  domain: 'app.example.com',
  upstream: { type: 'manual' as const, ref: 'localhost', port: 8080 },
  cloudflare: { zoneId: 'zone1', recordId: 'rec1' },
  tls: { enabled: false },
  createdAt: '2024-01-01T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAdd.mockResolvedValue(undefined)
  mockUpdate.mockResolvedValue(undefined)
  mockRemove.mockResolvedValue(undefined)
  mockAddRoute.mockResolvedValue(undefined)
  mockRemoveRoute.mockResolvedValue(undefined)
  mockDeleteRecord.mockResolvedValue(undefined)
})

// ─── GET /api/proxies ────────────────────────────────────────────────────────

describe('GET /api/proxies', () => {
  it('returns all proxies', async () => {
    mockReadAll.mockResolvedValue([baseProxy])
    const res = await request(app).get('/api/proxies')
    expect(res.status).toBe(200)
    expect(res.body).toEqual([baseProxy])
  })

  it('returns 500 on store error', async () => {
    mockReadAll.mockRejectedValue(new Error('disk error'))
    const res = await request(app).get('/api/proxies')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to read proxies')
  })
})

// ─── POST /api/proxies ───────────────────────────────────────────────────────

describe('POST /api/proxies — manual upstream', () => {
  it('creates a proxy and returns 201', async () => {
    mockCreateRecord.mockResolvedValue({ id: 'rec-new', name: 'app.example.com', type: 'A', content: 'localhost', proxied: false })

    const body = {
      domain: 'app.example.com',
      upstream: { type: 'manual', ref: 'localhost', port: 8080 },
      cloudflare: { zoneId: 'zone1' },
      tls: { enabled: false },
    }
    const res = await request(app).post('/api/proxies').send(body)

    expect(res.status).toBe(201)
    expect(res.body.domain).toBe('app.example.com')
    expect(res.body.cloudflare.recordId).toBe('rec-new')
    expect(res.body.id).toBeDefined()
    expect(mockCreateRecord).toHaveBeenCalledWith('zone1', { name: 'app.example.com', type: 'A', content: 'localhost', proxied: false })
    expect(mockAddRoute).toHaveBeenCalledTimes(1)
    expect(mockAdd).toHaveBeenCalledTimes(1)
  })

  it('defaults port to 80 when not provided', async () => {
    mockCreateRecord.mockResolvedValue({ id: 'rec1', name: 'app.example.com', type: 'A', content: 'myhost', proxied: false })

    const body = {
      domain: 'app.example.com',
      upstream: { type: 'manual', ref: 'myhost' },
      cloudflare: { zoneId: 'zone1' },
      tls: { enabled: false },
    }
    const res = await request(app).post('/api/proxies').send(body)
    expect(res.status).toBe(201)
    expect(res.body.upstream.port).toBe(80)
  })

  it('returns 400 on Zod validation failure', async () => {
    const res = await request(app).post('/api/proxies').send({ domain: '' })
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('Invalid request body')
    expect(res.body.details).toBeInstanceOf(Array)
  })

  it('returns 500 when Cloudflare create fails', async () => {
    mockCreateRecord.mockRejectedValue(new Error('CF error'))
    const body = {
      domain: 'app.example.com',
      upstream: { type: 'manual', ref: 'localhost', port: 8080 },
      cloudflare: { zoneId: 'zone1' },
      tls: { enabled: false },
    }
    const res = await request(app).post('/api/proxies').send(body)
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to create proxy')
  })
})

describe('POST /api/proxies — docker upstream', () => {
  it('resolves container IP from docker client', async () => {
    mockListContainers.mockResolvedValue([
      { id: 'cid', name: 'myapp', image: 'node:20', ports: [{ internal: 3000 }], networks: ['bridge'], networkIps: { bridge: '172.17.0.5' }, status: 'Up' },
    ])
    mockCreateRecord.mockResolvedValue({ id: 'rec1', name: 'app.example.com', type: 'A', content: '172.17.0.5', proxied: false })

    const body = {
      domain: 'app.example.com',
      upstream: { type: 'docker', ref: 'myapp', port: 3000 },
      cloudflare: { zoneId: 'zone1' },
      tls: { enabled: false },
    }
    const res = await request(app).post('/api/proxies').send(body)
    expect(res.status).toBe(201)
    expect(mockCreateRecord).toHaveBeenCalledWith('zone1', expect.objectContaining({ content: '172.17.0.5' }))
  })

  it('returns 500 when container is not found', async () => {
    mockListContainers.mockResolvedValue([])
    const body = {
      domain: 'app.example.com',
      upstream: { type: 'docker', ref: 'missing', port: 3000 },
      cloudflare: { zoneId: 'zone1' },
      tls: { enabled: false },
    }
    const res = await request(app).post('/api/proxies').send(body)
    expect(res.status).toBe(500)
    expect(res.body.details).toContain('missing')
  })
})

describe('POST /api/proxies — tailscale upstream', () => {
  it('resolves node IPv4 from tailscale client', async () => {
    mockListDevices.mockResolvedValue([
      { id: 'n1', hostname: 'mynode', ipv4: '100.64.0.1', ipv6: '', os: 'linux', online: true },
    ])
    mockCreateRecord.mockResolvedValue({ id: 'rec1', name: 'app.example.com', type: 'A', content: '100.64.0.1', proxied: false })

    const body = {
      domain: 'app.example.com',
      upstream: { type: 'tailscale', ref: 'mynode', port: 8080 },
      cloudflare: { zoneId: 'zone1' },
      tls: { enabled: false },
    }
    const res = await request(app).post('/api/proxies').send(body)
    expect(res.status).toBe(201)
    expect(mockCreateRecord).toHaveBeenCalledWith('zone1', expect.objectContaining({ content: '100.64.0.1' }))
  })
})

// ─── PUT /api/proxies/:id ────────────────────────────────────────────────────

describe('PUT /api/proxies/:id', () => {
  it('patches tls without triggering rebuild', async () => {
    mockFindById.mockResolvedValue(baseProxy)

    const res = await request(app)
      .put('/api/proxies/test-id')
      .send({ tls: { enabled: true, email: 'admin@example.com' } })

    expect(res.status).toBe(200)
    expect(res.body.tls.enabled).toBe(true)
    expect(mockRemoveRoute).not.toHaveBeenCalled()
    expect(mockDeleteRecord).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledTimes(1)
  })

  it('rebuilds DNS + Caddy when domain changes', async () => {
    mockFindById.mockResolvedValue(baseProxy)
    mockCreateRecord.mockResolvedValue({ id: 'rec-new', name: 'new.example.com', type: 'A', content: 'localhost', proxied: false })

    const res = await request(app)
      .put('/api/proxies/test-id')
      .send({ domain: 'new.example.com' })

    expect(res.status).toBe(200)
    expect(mockRemoveRoute).toHaveBeenCalledWith('test-id')
    expect(mockDeleteRecord).toHaveBeenCalledWith('zone1', 'rec1')
    expect(mockCreateRecord).toHaveBeenCalledWith('zone1', expect.objectContaining({ name: 'new.example.com' }))
    expect(mockAddRoute).toHaveBeenCalledTimes(1)
    expect(res.body.cloudflare.recordId).toBe('rec-new')
  })

  it('returns 404 when proxy does not exist', async () => {
    mockFindById.mockResolvedValue(undefined)
    const res = await request(app).put('/api/proxies/missing').send({ tls: { enabled: true } })
    expect(res.status).toBe(404)
  })

  it('returns 400 on invalid body', async () => {
    mockFindById.mockResolvedValue(baseProxy)
    const res = await request(app).put('/api/proxies/test-id').send({ upstream: { port: -1 } })
    expect(res.status).toBe(400)
  })
})

// ─── DELETE /api/proxies/:id ─────────────────────────────────────────────────

describe('DELETE /api/proxies/:id', () => {
  it('removes route, DNS record, and store entry', async () => {
    mockFindById.mockResolvedValue(baseProxy)

    const res = await request(app).delete('/api/proxies/test-id')

    expect(res.status).toBe(204)
    expect(mockRemoveRoute).toHaveBeenCalledWith('test-id')
    expect(mockDeleteRecord).toHaveBeenCalledWith('zone1', 'rec1')
    expect(mockRemove).toHaveBeenCalledWith('test-id')
  })

  it('returns 404 when proxy does not exist', async () => {
    mockFindById.mockResolvedValue(undefined)
    const res = await request(app).delete('/api/proxies/missing')
    expect(res.status).toBe(404)
  })

  it('returns 500 when Caddy remove fails', async () => {
    mockFindById.mockResolvedValue(baseProxy)
    mockRemoveRoute.mockRejectedValue(new Error('Caddy error'))

    const res = await request(app).delete('/api/proxies/test-id')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to delete proxy')
  })
})
