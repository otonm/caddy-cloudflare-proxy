import { useQuery } from '@tanstack/react-query'
import { getCloudflareRecords, getCloudflareZones } from '@/api/client'

export function useCloudflareZones() {
  return useQuery({ queryKey: ['cloudflare', 'zones'], queryFn: getCloudflareZones })
}

export function useCloudflareRecords(zoneId: string | null) {
  return useQuery({
    queryKey: ['cloudflare', 'records', zoneId],
    queryFn: () => getCloudflareRecords(zoneId!),
    enabled: !!zoneId,
  })
}
