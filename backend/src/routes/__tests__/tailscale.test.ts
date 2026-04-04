import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../clients/tailscale', () => ({
  listDevices: vi.fn(),
}))

import { listDevices } from '../../clients/tailscale'
import tailscaleRouter from '../tailscale'

const app = express()
app.use('/api/tailscale', tailscaleRouter)

const mockList = vi.mocked(listDevices)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/tailscale/nodes', () => {
  it('returns node list', async () => {
    const nodes = [
      { id: 'n1', hostname: 'myhost', ipv4: '100.64.0.1', ipv6: '', os: 'linux', online: true },
    ]
    mockList.mockResolvedValue(nodes)

    const res = await request(app).get('/api/tailscale/nodes')
    expect(res.status).toBe(200)
    expect(res.body).toEqual(nodes)
  })

  it('returns 500 when Tailscale client throws', async () => {
    mockList.mockRejectedValue(new Error('unauthorized'))

    const res = await request(app).get('/api/tailscale/nodes')
    expect(res.status).toBe(500)
    expect(res.body.error).toBe('Failed to list Tailscale nodes')
    expect(res.body.details).toBe('unauthorized')
  })
})
