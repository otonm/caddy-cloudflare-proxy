import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../clients/docker', () => ({
  listRunningContainers: vi.fn(),
}));

import { listRunningContainers } from '../../clients/docker';
import dockerRouter from '../docker';

const app = express();
app.use('/api/docker', dockerRouter);

const mockList = vi.mocked(listRunningContainers);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/docker/containers', () => {
  it('returns container list', async () => {
    const containers = [
      {
        id: 'abc',
        name: 'myapp',
        image: 'node:20',
        ports: [],
        networks: ['bridge'],
        networkIps: { bridge: '172.17.0.2' },
        status: 'Up',
      },
    ];
    mockList.mockResolvedValue(containers);

    const res = await request(app).get('/api/docker/containers');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(containers);
  });

  it('returns 500 when Docker client throws', async () => {
    mockList.mockRejectedValue(new Error('socket not found'));

    const res = await request(app).get('/api/docker/containers');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to list Docker containers');
    expect(res.body.details).toBe('socket not found');
  });
});
