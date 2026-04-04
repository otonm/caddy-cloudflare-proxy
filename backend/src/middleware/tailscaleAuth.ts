import type { Request, Response, NextFunction } from 'express'

const TAILSCALE_IPV4 = /^100\./
const TAILSCALE_IPV6 = /^fd7a:/i

export function tailscaleAuth(req: Request, res: Response, next: NextFunction) {
  if (process.env.DISABLE_AUTH === 'true') {
    return next()
  }

  const ip = req.socket.remoteAddress ?? ''

  if (TAILSCALE_IPV4.test(ip) || TAILSCALE_IPV6.test(ip)) {
    return next()
  }

  res.status(403).json({ error: 'Forbidden: Tailscale connection required' })
}
