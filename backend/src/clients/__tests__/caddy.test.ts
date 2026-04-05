import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaddyRoute } from '../caddy';

const BASE = 'http://caddy:2019';

const fakeRoute: CaddyRoute = {
  '@id': 'proxy-abc',
  match: [{ host: ['app.example.com'] }],
  handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: 'container:8080' }] }],
  terminal: true,
};

beforeEach(() => {
  process.env.CADDY_ADMIN_URL = BASE;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(responses: { url?: string | RegExp; ok: boolean; body?: unknown }[]) {
  let callIndex = 0;
  vi.spyOn(global, 'fetch').mockImplementation(async (_url) => {
    const entry = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return {
      ok: entry.ok,
      status: entry.ok ? 200 : 404,
      text: () => Promise.resolve(JSON.stringify(entry.body ?? '')),
      json: () => Promise.resolve(entry.body),
    } as Response;
  });
}

describe('getConfig', () => {
  it('returns parsed config JSON', async () => {
    const config = { apps: { http: {} } };
    mockFetch([{ ok: true, body: config }]);
    const { getConfig } = await import('../caddy');
    expect(await getConfig()).toEqual(config);
  });
});

describe('getRoutes', () => {
  it('returns routes from server config', async () => {
    const config = {
      apps: { http: { servers: { proxy: { routes: [fakeRoute] } } } },
    };
    mockFetch([{ ok: true, body: config }]);
    const { getRoutes } = await import('../caddy');
    expect(await getRoutes()).toEqual([fakeRoute]);
  });

  it('returns empty array when no HTTP server is configured', async () => {
    mockFetch([{ ok: true, body: {} }]);
    const { getRoutes } = await import('../caddy');
    expect(await getRoutes()).toEqual([]);
  });
});

describe('addRoute', () => {
  it('uses POST to append on success', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    const { addRoute } = await import('../caddy');
    await addRoute(fakeRoute);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('/routes/...'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('falls back to PUT when POST returns 404', async () => {
    const spy = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('not found'),
      } as Response)
      .mockResolvedValueOnce({ ok: true } as Response);
    const { addRoute } = await import('../caddy');
    await addRoute(fakeRoute);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/routes'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('throws when both POST and PUT fail', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve(''),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('error'),
      } as Response);
    const { addRoute } = await import('../caddy');
    await expect(addRoute(fakeRoute)).rejects.toThrow('500');
  });
});

describe('removeRoute', () => {
  it('sends DELETE to /id/{routeId}', async () => {
    const spy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as Response);
    const { removeRoute } = await import('../caddy');
    await removeRoute('proxy-abc');
    expect(spy).toHaveBeenCalledWith(
      `${BASE}/id/proxy-abc`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('resolves silently when route is already gone (404)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('not found'),
    } as Response);
    const { removeRoute } = await import('../caddy');
    await expect(removeRoute('missing')).resolves.toBeUndefined();
  });

  it('resolves silently when route is already gone (400)', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve('invalid traversal path'),
    } as Response);
    const { removeRoute } = await import('../caddy');
    await expect(removeRoute('missing')).resolves.toBeUndefined();
  });

  it('throws when DELETE fails with a server error', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('internal error'),
    } as Response);
    const { removeRoute } = await import('../caddy');
    await expect(removeRoute('proxy-abc')).rejects.toThrow('500');
  });
});
