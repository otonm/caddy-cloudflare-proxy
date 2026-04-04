import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockZonesList, mockRecordsList, mockRecordsCreate, mockRecordsDelete } = vi.hoisted(() => ({
  mockZonesList: vi.fn(),
  mockRecordsList: vi.fn(),
  mockRecordsCreate: vi.fn(),
  mockRecordsDelete: vi.fn(),
}))

vi.mock('cloudflare', () => ({
  default: class MockCloudflare {
    zones = { list: mockZonesList }
    dns = {
      records: {
        list: mockRecordsList,
        create: mockRecordsCreate,
        delete: mockRecordsDelete,
      },
    }
  },
}))

import { listZones, listRecords, createRecord, deleteRecord } from '../cloudflare'

function makeAsyncIterable<T>(items: T[]): AsyncIterable<T> {
  return {
    [Symbol.asyncIterator]: async function* () {
      yield* items
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CF_API_TOKEN = 'test-token'
})

describe('listZones', () => {
  it('collects all pages and maps fields', async () => {
    mockZonesList.mockReturnValue(
      makeAsyncIterable([
        { id: 'z1', name: 'example.com', status: 'active' },
        { id: 'z2', name: 'other.com', status: 'pending' },
      ])
    )
    const result = await listZones()
    expect(result).toEqual([
      { id: 'z1', name: 'example.com', status: 'active' },
      { id: 'z2', name: 'other.com', status: 'pending' },
    ])
  })

  it('falls back to empty string for missing status', async () => {
    mockZonesList.mockReturnValue(makeAsyncIterable([{ id: 'z1', name: 'x.com' }]))
    const [zone] = await listZones()
    expect(zone.status).toBe('')
  })
})

describe('listRecords', () => {
  it('maps DNS record fields', async () => {
    mockRecordsList.mockReturnValue(
      makeAsyncIterable([
        { id: 'r1', name: 'app.example.com', type: 'A', content: '1.2.3.4', proxied: true },
      ])
    )
    const result = await listRecords('z1')
    expect(result).toEqual([
      { id: 'r1', name: 'app.example.com', type: 'A', content: '1.2.3.4', proxied: true },
    ])
    expect(mockRecordsList).toHaveBeenCalledWith({ zone_id: 'z1' })
  })
})

describe('createRecord', () => {
  it('calls sdk with correct params and returns mapped record', async () => {
    mockRecordsCreate.mockResolvedValue({
      id: 'r2',
      name: 'new.example.com',
      type: 'A',
      content: '5.6.7.8',
      proxied: false,
    })
    const result = await createRecord('z1', {
      name: 'new.example.com',
      type: 'A',
      content: '5.6.7.8',
      proxied: false,
    })
    expect(mockRecordsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        zone_id: 'z1',
        type: 'A',
        name: 'new.example.com',
        content: '5.6.7.8',
        proxied: false,
        ttl: 1,
      })
    )
    expect(result.id).toBe('r2')
  })
})

describe('deleteRecord', () => {
  it('calls sdk delete with correct zone and record ids', async () => {
    mockRecordsDelete.mockResolvedValue(undefined)
    await deleteRecord('z1', 'r1')
    expect(mockRecordsDelete).toHaveBeenCalledWith('r1', { zone_id: 'z1' })
  })
})
