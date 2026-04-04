export interface TailscaleNode {
  id: string
  hostname: string
  ipv4: string
  ipv6: string
  os: string
  online: boolean
}

export async function listDevices(): Promise<TailscaleNode[]> {
  const apiKey = process.env.TS_API_KEY
  const tailnet = process.env.TS_TAILNET
  if (!apiKey || !tailnet) throw new Error('TS_API_KEY and TS_TAILNET are required')

  const res = await fetch(
    `https://api.tailscale.com/api/v2/tailnet/${encodeURIComponent(tailnet)}/devices`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  )
  if (!res.ok) {
    throw new Error(`Tailscale API error ${res.status}: ${await res.text()}`)
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
