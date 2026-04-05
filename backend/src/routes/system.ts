import os from 'node:os';
import { Router } from 'express';
import { listDevices } from '../clients/tailscale';

const router = Router();

async function getTailscaleHostIp(): Promise<string | null> {
  try {
    const hostname = os.hostname();
    const devices = await listDevices();
    const match = devices.find((d) => d.hostname === hostname);
    return match?.ipv4 ?? null;
  } catch {
    return null;
  }
}

async function getPublicIp(): Promise<string | null> {
  try {
    const res = await fetch('https://api4.ipify.org?format=json', { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = (await res.json()) as { ip: string };
    return data.ip ?? null;
  } catch {
    return null;
  }
}

router.get('/externalIps', async (_req, res) => {
  const [tailscale, publicIp] = await Promise.all([getTailscaleHostIp(), getPublicIp()]);
  res.json({ tailscale, public: publicIp });
});

export default router;
