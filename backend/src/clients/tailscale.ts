import { debug } from '../utils';

export interface TailscaleNode {
  id: string;
  hostname: string;
  name: string;
  ipv4: string;
  ipv6: string;
  os: string;
  online: boolean;
}

export async function listDevices(): Promise<TailscaleNode[]> {
  const missing = ['TS_API_KEY', 'TS_TAILNET'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  const apiKey = process.env.TS_API_KEY!;
  const tailnet = process.env.TS_TAILNET!;

  const url = `https://api.tailscale.com/api/v2/tailnet/${encodeURIComponent(tailnet)}/devices`;
  debug('[tailscale]', 'GET', url);

  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  debug('[tailscale]', 'response status', res.status);

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) detail += `: ${body.message}`;
    } catch {
      // body was not JSON; ignore
    }
    throw new Error(`Tailscale API error — ${detail} (tailnet: ${tailnet})`);
  }

  const data = (await res.json()) as { devices: TailscaleApiDevice[] };
  debug('[tailscale]', 'devices received', data.devices.length);

  const nodes = data.devices.map(mapDevice);
  debug('[tailscale]', 'mapped nodes', nodes.map((n) => `${n.name}->${n.hostname}(${n.ipv4})`).join(', '));
  return nodes;
}

interface TailscaleApiDevice {
  id: string;
  hostname: string;
  name: string;
  addresses: string[];
  os: string;
  connectedToControl: boolean;
}

function mapDevice(d: TailscaleApiDevice): TailscaleNode {
  return {
    id: d.id,
    hostname: d.hostname,
    name: d.name,
    ipv4: d.addresses.find((a) => a.startsWith('100.')) ?? '',
    ipv6: d.addresses.find((a) => a.startsWith('fd7a:')) ?? '',
    os: d.os,
    online: d.connectedToControl,
  };
}
