import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockListContainers } = vi.hoisted(() => ({
  mockListContainers: vi.fn(),
}))

vi.mock('dockerode', () => ({
  default: class MockDocker {
    listContainers = mockListContainers
  },
}))

import { listRunningContainers } from '../docker'

const fakeContainer = {
  Id: 'abc123',
  Names: ['/my-app'],
  Image: 'nginx:latest',
  Ports: [{ PrivatePort: 80, PublicPort: 8080, Type: 'tcp' }],
  NetworkSettings: { Networks: { bridge: {}, mynet: {} } },
  Status: 'Up 2 hours',
}

beforeEach(() => {
  mockListContainers.mockReset()
})

describe('listRunningContainers', () => {
  it('maps container fields and strips leading slash from name', async () => {
    mockListContainers.mockResolvedValue([fakeContainer])
    const result = await listRunningContainers()
    expect(result).toEqual([
      {
        id: 'abc123',
        name: 'my-app',
        image: 'nginx:latest',
        ports: [{ internal: 80, external: 8080 }],
        networks: ['bridge', 'mynet'],
        status: 'Up 2 hours',
      },
    ])
  })

  it('returns empty array when no containers are running', async () => {
    mockListContainers.mockResolvedValue([])
    expect(await listRunningContainers()).toEqual([])
  })

  it('handles container with no published port', async () => {
    mockListContainers.mockResolvedValue([
      { ...fakeContainer, Ports: [{ PrivatePort: 3000, Type: 'tcp' }] },
    ])
    const [c] = await listRunningContainers()
    expect(c.ports).toEqual([{ internal: 3000, external: undefined }])
  })
})
