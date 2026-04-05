import { Router } from 'express';
import { listDevices } from '../clients/tailscale';
import { isUpstreamError } from '../utils';

const router = Router();

router.get('/nodes', async (_req, res) => {
  try {
    const nodes = await listDevices();
    res.json(nodes);
  } catch (err) {
    console.error('[tailscale] Failed to list nodes:', err);
    res.status(isUpstreamError(err) ? 502 : 500).json({
      error: 'Failed to list Tailscale nodes',
      details: err instanceof Error ? err.message : null,
    });
  }
});

export default router;
