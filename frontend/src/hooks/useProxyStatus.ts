import { useQuery } from '@tanstack/react-query';
import { getProxyStatus } from '@/api/client';

export function useProxyStatus(id: string) {
  return useQuery({
    queryKey: ['proxy-status', id],
    queryFn: () => getProxyStatus(id),
    refetchInterval: 30_000,
    staleTime: 25_000,
  });
}
