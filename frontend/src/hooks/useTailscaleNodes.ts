import { useQuery } from '@tanstack/react-query'
import { getTailscaleNodes } from '@/api/client'

export function useTailscaleNodes() {
  return useQuery({ queryKey: ['tailscale', 'nodes'], queryFn: getTailscaleNodes, staleTime: 30_000 })
}
