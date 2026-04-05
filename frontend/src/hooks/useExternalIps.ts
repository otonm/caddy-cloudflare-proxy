import { useQuery } from '@tanstack/react-query';
import { getExternalIps } from '@/api/client';

export function useExternalIps() {
  return useQuery({
    queryKey: ['system', 'externalIps'],
    queryFn: getExternalIps,
    staleTime: 60_000,
  });
}
