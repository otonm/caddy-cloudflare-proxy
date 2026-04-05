import { useState } from 'react';
import { ProxyDialog } from '@/components/ProxyDialog';
import { ProxyTable } from '@/components/ProxyTable';
import type { Proxy } from '@/types';

export default function App() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editProxy, setEditProxy] = useState<Proxy | undefined>();

  function handleAdd() {
    setEditProxy(undefined);
    setDialogOpen(true);
  }

  function handleEdit(proxy: Proxy) {
    setEditProxy(proxy);
    setDialogOpen(true);
  }

  function handleDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditProxy(undefined);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-6 py-4">
          <h1 className="text-xl font-semibold">Caddy Cloudflare Proxy</h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <ProxyTable onAdd={handleAdd} onEdit={handleEdit} />
      </main>

      <ProxyDialog open={dialogOpen} onOpenChange={handleDialogChange} proxy={editProxy} />
    </div>
  );
}
