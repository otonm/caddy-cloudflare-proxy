import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { CloudflarePicker } from '@/components/CloudflarePicker';
import { TLSSection } from '@/components/TLSSection';
import { UpstreamPicker } from '@/components/UpstreamPicker';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfig } from '@/hooks/useConfig';
import { useExternalIps } from '@/hooks/useExternalIps';
import { useCreateProxy, useUpdateProxy } from '@/hooks/useProxies';
import type { Proxy } from '@/types';

// ─── Zod schema ───────────────────────────────────────────────────────────────

const proxyFormSchema = z.object({
  domain: z
    .string()
    .min(1, 'Required')
    .regex(/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/, 'Must be a valid hostname'),
  upstream: z.object({
    type: z.enum(['docker', 'tailscale', 'manual']),
    ref: z.string().min(1, 'Required'),
    port: z.coerce.number().int().min(1, 'Min 1').max(65535, 'Max 65535'),
    publicIp: z.string().min(1, 'Select a public endpoint for DNS'),
  }),
  cloudflare: z
    .object({
      zoneId: z.string().min(1, 'Zone is required'),
      recordChoice: z.enum(['new', 'existing']),
      recordId: z.string().optional(),
    })
    .refine((cf) => cf.recordChoice === 'new' || (cf.recordId && cf.recordId.length > 0), {
      message: 'Select a DNS record',
      path: ['recordId'],
    }),
  tls: z
    .object({
      enabled: z.boolean(),
      email: z.string().email('Must be a valid email').or(z.literal('')).optional(),
    })
    .refine((tls) => !tls.enabled || (tls.email && tls.email.length > 0), {
      message: 'Email required when TLS is enabled',
      path: ['email'],
    }),
});

export type ProxyFormValues = z.infer<typeof proxyFormSchema>;

// ─── PublicEndpointPicker ─────────────────────────────────────────────────────

function PublicEndpointPicker() {
  const externalIps = useExternalIps();
  const { setValue, formState: { errors } } = useFormContext<ProxyFormValues>();
  const publicIp = useWatch<ProxyFormValues, 'upstream.publicIp'>({ name: 'upstream.publicIp' });

  return (
    <div className="space-y-1">
      <Label>Public endpoint (for DNS)</Label>
      {externalIps.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <RadioGroup
          value={publicIp ?? ''}
          onValueChange={(v) => setValue('upstream.publicIp', v, { shouldValidate: true })}
          className="gap-2"
        >
          <div
            className={`flex items-center gap-2 rounded border px-3 py-2 ${!externalIps.data?.tailscale ? 'opacity-40' : ''}`}
          >
            <RadioGroupItem
              id="endpoint-tailscale"
              value={externalIps.data?.tailscale ?? ''}
              disabled={!externalIps.data?.tailscale}
            />
            <Label htmlFor="endpoint-tailscale" className="cursor-pointer font-normal">
              Tailscale
              <span className="text-muted-foreground ml-2 font-mono text-xs">
                {externalIps.data?.tailscale ?? 'not detected'}
              </span>
            </Label>
          </div>
          <div
            className={`flex items-center gap-2 rounded border px-3 py-2 ${!externalIps.data?.public ? 'opacity-40' : ''}`}
          >
            <RadioGroupItem
              id="endpoint-public"
              value={externalIps.data?.public ?? ''}
              disabled={!externalIps.data?.public}
            />
            <Label htmlFor="endpoint-public" className="cursor-pointer font-normal">
              Public IP
              <span className="text-muted-foreground ml-2 font-mono text-xs">
                {externalIps.data?.public ?? 'not detected'}
              </span>
            </Label>
          </div>
        </RadioGroup>
      )}
      {errors.upstream?.publicIp && (
        <p className="text-destructive text-xs">{errors.upstream.publicIp.message}</p>
      )}
    </div>
  );
}

// ─── ProxyDialog ──────────────────────────────────────────────────────────────

interface ProxyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proxy?: Proxy;
}

export function ProxyDialog({ open, onOpenChange, proxy }: ProxyDialogProps) {
  const isEdit = !!proxy;
  const { data: config } = useConfig();
  const createMutation = useCreateProxy();
  const updateMutation = useUpdateProxy();

  const form = useForm<ProxyFormValues>({
    resolver: zodResolver(proxyFormSchema),
    defaultValues: {
      domain: '',
      upstream: { type: 'docker', ref: '', port: 80, publicIp: '' },
      cloudflare: { zoneId: '', recordChoice: 'new', recordId: undefined },
      tls: { enabled: false, email: '' },
    },
  });

  // Populate form on open/proxy change. config is intentionally omitted from deps
  // to prevent re-running (and wiping user input) when the config query resolves.
  useEffect(() => {
    if (!open) return;
    if (proxy) {
      form.reset({
        domain: proxy.domain,
        upstream: { ...proxy.upstream },
        cloudflare: { zoneId: proxy.cloudflare.zoneId, recordChoice: 'new', recordId: undefined },
        tls: {
          enabled: proxy.tls.enabled,
          email: proxy.tls.email ?? config?.acmeEmail ?? '',
        },
      });
    } else {
      form.reset({
        domain: '',
        upstream: { type: 'docker', ref: '', port: 80, publicIp: '' },
        cloudflare: { zoneId: '', recordChoice: 'new', recordId: undefined },
        tls: { enabled: false, email: config?.acmeEmail ?? '' },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proxy]);

  // When config loads after the dialog is already open, back-fill email only
  useEffect(() => {
    if (!open || !config?.acmeEmail) return;
    if (!form.getValues('tls.email')) {
      form.setValue('tls.email', config.acmeEmail);
    }
  }, [open, config?.acmeEmail]);

  const recordChoice = form.watch('cloudflare.recordChoice');
  const isPending = createMutation.isPending || updateMutation.isPending;

  function onSubmit(values: ProxyFormValues) {
    const apiData = {
      domain: values.domain,
      upstream: values.upstream,
      cloudflare: {
        zoneId: values.cloudflare.zoneId,
        ...(values.cloudflare.recordChoice === 'existing' && values.cloudflare.recordId
          ? { recordId: values.cloudflare.recordId }
          : {}),
      },
      tls: {
        enabled: values.tls.enabled,
        email: values.tls.email || undefined,
      },
    };

    if (isEdit) {
      updateMutation.mutate(
        { id: proxy.id, data: apiData },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createMutation.mutate(apiData, { onSuccess: () => onOpenChange(false) });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Proxy' : 'Add Proxy'}</DialogTitle>
        </DialogHeader>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* Domain */}
            <div className="space-y-1">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="app.example.com"
                {...form.register('domain')}
                disabled={recordChoice === 'existing'}
              />
              {form.formState.errors.domain && (
                <p className="text-destructive text-xs">{form.formState.errors.domain.message}</p>
              )}
            </div>

            {/* Upstream */}
            <UpstreamPicker control={form.control} />

            {/* Public endpoint (DNS target) */}
            <PublicEndpointPicker />

            {/* Cloudflare */}
            <CloudflarePicker control={form.control} editMode={isEdit} />

            {/* TLS */}
            <TLSSection control={form.control} acmeEmail={config?.acmeEmail} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? 'Save changes' : 'Add proxy'}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
