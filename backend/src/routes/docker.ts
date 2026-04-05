import { Router } from 'express';
import { listRunningContainers } from '../clients/docker';
import { isUpstreamError } from '../utils';

const router = Router();

router.get('/containers', async (_req, res) => {
  try {
    const containers = await listRunningContainers();
    res.json(containers);
  } catch (err) {
    res.status(isUpstreamError(err) ? 502 : 500).json({
      error: 'Failed to list Docker containers',
      details: err instanceof Error ? err.message : null,
    });
  }
});

export default router;
