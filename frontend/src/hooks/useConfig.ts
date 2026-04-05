import { useQuery } from '@tanstack/react-query';
import { getConfig } from '@/api/client';

export function useConfig() {
  return useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: Infinity });
}
