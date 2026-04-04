import { Router } from 'express'
import { listDevices } from '../clients/tailscale'

const router = Router()

router.get('/nodes', async (_req, res) => {
  try {
    const nodes = await listDevices()
    res.json(nodes)
  } catch (err) {
    res.status(500).json({ error: 'Failed to list Tailscale nodes', details: err instanceof Error ? err.message : null })
  }
})

export default router
