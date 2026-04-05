export interface TailscaleNode {
  id: string
  hostname: string
  ipv4: string
  ipv6: string
  os: string
  online: boolean
}

export async function listDevices(): Promise<TailscaleNode[]> {
  const missing = ['TS_API_KEY', 'TS_TAILNET'].filter((k) => !process.env[k])
  if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  const apiKey = process.env.TS_API_KEY!
  const tailnet = process.env.TS_TAILNET!

  const res = await fetch(
    `https://api.tailscale.com/api/v2/tailnet/${encodeURIComponent(tailnet)}/devices`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) detail += `: ${body.message}`
    } catch {
      // body was not JSON; ignore
    }
    throw new Error(`Tailscale API error — ${detail} (tailnet: ${tailnet})`)
  }

  const data = (await res.json()) as { devices: TailscaleApiDevice[] }
  return data.devices.map(mapDevice)
}

interface TailscaleApiDevice {
  id: string
  hostname: string
  addresses: string[]
  os: string
  connectedToControl: boolean
}

function mapDevice(d: TailscaleApiDevice): TailscaleNode {
  return {
    id: d.id,
    hostname: d.hostname,
    ipv4: d.addresses.find((a) => a.startsWith('100.')) ?? '',
    ipv6: d.addresses.find((a) => a.startsWith('fd7a:')) ?? '',
    os: d.os,
    online: d.connectedToControl,
  }
}
