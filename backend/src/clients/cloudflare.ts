import Cloudflare from 'cloudflare'

export interface Zone {
  id: string
  name: string
  status: string
}

export interface DnsRecord {
  id: string
  name: string
  type: string
  content: string
  proxied: boolean
}

const client = new Cloudflare({ apiToken: process.env.CF_API_TOKEN })

export async function listZones(): Promise<Zone[]> {
  const zones: Zone[] = []
  for await (const z of client.zones.list()) {
    zones.push({ id: z.id, name: z.name, status: z.status ?? '' })
  }
  return zones
}

export async function listRecords(zoneId: string): Promise<DnsRecord[]> {
  const records: DnsRecord[] = []
  for await (const r of client.dns.records.list({ zone_id: zoneId })) {
    records.push({
      id: r.id,
      name: r.name,
      type: r.type ?? '',
      content: 'content' in r ? String(r.content ?? '') : '',
      proxied: 'proxied' in r ? Boolean(r.proxied) : false,
    })
  }
  return records
}

export async function createRecord(
  zoneId: string,
  record: { name: string; type: 'A' | 'CNAME'; content: string; proxied: boolean }
): Promise<DnsRecord> {
  const r = await client.dns.records.create({
    zone_id: zoneId,
    type: record.type,
    name: record.name,
    content: record.content,
    proxied: record.proxied,
    ttl: 1,
  })
  return {
    id: r.id,
    name: r.name,
    type: r.type ?? '',
    content: 'content' in r ? String(r.content ?? '') : '',
    proxied: 'proxied' in r ? Boolean(r.proxied) : false,
  }
}

export async function deleteRecord(zoneId: string, recordId: string): Promise<void> {
  await client.dns.records.delete(recordId, { zone_id: zoneId })
}
