import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { TableCell, TableRow } from '@/components/ui/table'
import { useProxyStatus } from '@/hooks/useProxyStatus'
import type { Proxy, ProxyStatus } from '@/types'

function StatusBadge({ id }: { id: string }) {
  const { data, isLoading } = useProxyStatus(id)

  const status: ProxyStatus = isLoading ? 'loading' : (data?.status ?? 'error')

  const variants: Record<ProxyStatus, { label: string; className: string }> = {
    active: { label: 'active', className: 'bg-green-100 text-green-800 border-green-200' },
    error: { label: 'error', className: 'bg-red-100 text-red-800 border-red-200' },
    loading: { label: 'checking', className: 'bg-gray-100 text-gray-500 border-gray-200' },
  }

  const { label, className } = variants[status]
  return (
    <Badge variant="outline" className={className} title={data?.reason}>
      {label}
    </Badge>
  )
}

interface ProxyRowProps {
  proxy: Proxy
  onEdit: () => void
  onDelete: () => void
}

export function ProxyRow({ proxy, onEdit, onDelete }: ProxyRowProps) {
  const [open, setOpen] = useState(false)

  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline">{proxy.domain}</Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {proxy.upstream.type} · {proxy.upstream.ref}:{proxy.upstream.port}
      </TableCell>
      <TableCell>
        {proxy._pending
          ? <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">pending</Badge>
          : <StatusBadge id={proxy.id} />}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" onClick={onEdit} disabled={proxy._pending} aria-label="Edit proxy">
          <Pencil className="h-4 w-4" />
        </Button>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
            aria-label="Delete proxy"
            disabled={proxy._pending}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {proxy.domain}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the Caddy route and Cloudflare DNS record. This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setOpen(false)
                  onDelete()
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  )
}
