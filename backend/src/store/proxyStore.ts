import fs from 'node:fs/promises';
import path from 'node:path';

// Minimal Proxy type for the store — will be expanded in Step 3
export interface Proxy {
  id: string;
  domain: string;
  upstream: {
    type: 'docker' | 'tailscale' | 'manual';
    ref: string;
    port: number;
    publicIp?: string;
  };
  cloudflare: {
    zoneId: string;
    recordId: string;
  };
  tls: {
    enabled: boolean;
    email?: string;
  };
  createdAt: string;
}

function getFilePath() {
  return path.join(process.env.DATA_DIR ?? './data', 'proxies.json');
}

function getTmpFilePath() {
  return path.join(process.env.DATA_DIR ?? './data', 'proxies.tmp.json');
}

export async function readAll(): Promise<Proxy[]> {
  try {
    const raw = await fs.readFile(getFilePath(), 'utf-8');
    return JSON.parse(raw) as Proxy[];
  } catch (err: unknown) {
    if (isNodeError(err) && err.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

export async function writeAll(proxies: Proxy[]): Promise<void> {
  const tmp = getTmpFilePath();
  const dest = getFilePath();
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(proxies, null, 2), 'utf-8');
  await fs.rename(tmp, dest);
}

export async function add(proxy: Proxy): Promise<void> {
  const proxies = await readAll();
  proxies.push(proxy);
  await writeAll(proxies);
}

export async function update(id: string, patch: Partial<Proxy>): Promise<void> {
  const proxies = await readAll();
  const idx = proxies.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error(`Proxy not found: ${id}`);
  proxies[idx] = { ...proxies[idx], ...patch };
  await writeAll(proxies);
}

export async function remove(id: string): Promise<void> {
  const proxies = await readAll();
  const filtered = proxies.filter((p) => p.id !== id);
  if (filtered.length === proxies.length) throw new Error(`Proxy not found: ${id}`);
  await writeAll(filtered);
}

export async function findById(id: string): Promise<Proxy | undefined> {
  const proxies = await readAll();
  return proxies.find((p) => p.id === id);
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err;
}
