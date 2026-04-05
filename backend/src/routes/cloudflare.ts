import { Router } from 'express';
import { listRecords, listZones } from '../clients/cloudflare';
import { isUpstreamError } from '../utils';

const router = Router();

router.get('/zones', async (_req, res) => {
  try {
    const zones = await listZones();
    res.json(zones);
  } catch (err) {
    res.status(isUpstreamError(err) ? 502 : 500).json({
      error: 'Failed to list Cloudflare zones',
      details: err instanceof Error ? err.message : null,
    });
  }
});

router.get('/:zoneId/records', async (req, res) => {
  try {
    const records = await listRecords(req.params.zoneId);
    res.json(records);
  } catch (err) {
    res.status(isUpstreamError(err) ? 502 : 500).json({
      error: 'Failed to list DNS records',
      details: err instanceof Error ? err.message : null,
    });
  }
});

export default router;
