import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { listDevices } from '../tailscale'

const fakeDevice = {
  id: 'dev-1',
  hostname: 'my-host',
  addresses: ['100.64.0.1', 'fd7a:115c::1'],
  os: 'linux',
  connectedToControl: true,
}

beforeEach(() => {
  process.env.TS_API_KEY = 'test-key'
  process.env.TS_TAILNET = 'example.com'
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.TS_API_KEY
  delete process.env.TS_TAILNET
})

function mockFetch(body: unknown, ok = true, status = 200) {
  vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as Response)
}

describe('listDevices', () => {
  it('maps devices and derives online from connectedToControl', async () => {
    mockFetch({ devices: [fakeDevice] })
    const result = await listDevices()
    expect(result).toEqual([
      {
        id: 'dev-1',
        hostname: 'my-host',
        ipv4: '100.64.0.1',
        ipv6: 'fd7a:115c::1',
        os: 'linux',
        online: true,
      },
    ])
  })

  it('sets online=false when connectedToControl is false', async () => {
    mockFetch({ devices: [{ ...fakeDevice, connectedToControl: false }] })
    const [node] = await listDevices()
    expect(node.online).toBe(false)
  })

  it('returns empty ipv4/ipv6 when addresses are missing', async () => {
    mockFetch({ devices: [{ ...fakeDevice, addresses: [] }] })
    const [node] = await listDevices()
    expect(node.ipv4).toBe('')
    expect(node.ipv6).toBe('')
  })

  it('throws on non-ok response', async () => {
    mockFetch('Unauthorized', false, 401)
    await expect(listDevices()).rejects.toThrow('401')
  })

  it('throws when env vars are missing', async () => {
    delete process.env.TS_API_KEY
    await expect(listDevices()).rejects.toThrow('TS_API_KEY')
  })

  it('uses TS_TAILNET in the request URL', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ devices: [] }),
    } as Response)
    await listDevices()
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('example.com'),
      expect.anything()
    )
  })
})
