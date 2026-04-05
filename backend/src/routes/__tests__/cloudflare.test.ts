import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../clients/cloudflare', () => ({
  listZones: vi.fn(),
  listRecords: vi.fn(),
}));

import { listRecords, listZones } from '../../clients/cloudflare';
import cloudflareRouter from '../cloudflare';

const app = express();
app.use('/api/cloudflare', cloudflareRouter);

const mockZones = vi.mocked(listZones);
const mockRecords = vi.mocked(listRecords);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/cloudflare/zones', () => {
  it('returns zone list', async () => {
    const zones = [{ id: 'z1', name: 'example.com', status: 'active' }];
    mockZones.mockResolvedValue(zones);

    const res = await request(app).get('/api/cloudflare/zones');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(zones);
  });

  it('returns 500 when Cloudflare client throws', async () => {
    mockZones.mockRejectedValue(new Error('invalid token'));

    const res = await request(app).get('/api/cloudflare/zones');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to list Cloudflare zones');
  });
});

describe('GET /api/cloudflare/:zoneId/records', () => {
  it('returns DNS records for a zone', async () => {
    const records = [
      { id: 'r1', name: 'app.example.com', type: 'A', content: '1.2.3.4', proxied: false },
    ];
    mockRecords.mockResolvedValue(records);

    const res = await request(app).get('/api/cloudflare/z1/records');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(records);
    expect(mockRecords).toHaveBeenCalledWith('z1');
  });

  it('returns 500 when Cloudflare client throws', async () => {
    mockRecords.mockRejectedValue(new Error('zone not found'));

    const res = await request(app).get('/api/cloudflare/z1/records');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to list DNS records');
  });
});
