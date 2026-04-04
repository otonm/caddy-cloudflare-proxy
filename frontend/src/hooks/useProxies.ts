import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createProxy, deleteProxy, getProxies, updateProxy } from '@/api/client'
import type { CreateProxyInput, Proxy } from '@/types'

export function useProxies() {
  return useQuery({ queryKey: ['proxies'], queryFn: getProxies })
}

export function useCreateProxy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createProxy,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proxies'] })
      toast.success('Proxy created')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateProxy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateProxyInput> }) =>
      updateProxy(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['proxies'] })
      toast.success('Proxy updated')
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteProxy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteProxy,
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['proxies'] })
      const previous = qc.getQueryData<Proxy[]>(['proxies'])
      qc.setQueryData<Proxy[]>(['proxies'], (old) => old?.filter((p) => p.id !== id) ?? [])
      return { previous }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(['proxies'], ctx.previous)
      toast.error('Failed to delete proxy')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['proxies'] }),
  })
}
