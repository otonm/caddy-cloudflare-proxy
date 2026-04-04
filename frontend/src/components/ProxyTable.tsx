import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProxyRow } from '@/components/ProxyRow'
import { useDeleteProxy, useProxies } from '@/hooks/useProxies'
import type { Proxy } from '@/types'

interface ProxyTableProps {
  onAdd: () => void
  onEdit: (proxy: Proxy) => void
}

export function ProxyTable({ onAdd, onEdit }: ProxyTableProps) {
  const { data: proxies, isLoading, isError } = useProxies()
  const deleteMutation = useDeleteProxy()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load proxies. Is the backend running?
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Proxies</h2>
        <Button onClick={onAdd} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Proxy
        </Button>
      </div>

      {!proxies?.length ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">No proxies configured yet.</p>
          <Button variant="link" onClick={onAdd} className="mt-2">
            Add your first proxy
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Upstream</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {proxies.map((proxy) => (
                <ProxyRow
                  key={proxy.id}
                  proxy={proxy}
                  onEdit={() => onEdit(proxy)}
                  onDelete={() => deleteMutation.mutate(proxy.id)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
