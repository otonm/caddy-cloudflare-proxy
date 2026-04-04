import { useQuery } from '@tanstack/react-query'
import { getDockerContainers } from '@/api/client'

export function useDockerContainers() {
  return useQuery({ queryKey: ['docker', 'containers'], queryFn: getDockerContainers, staleTime: 30_000 })
}
