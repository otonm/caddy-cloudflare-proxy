import type { Control } from 'react-hook-form';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { ProxyFormValues } from '@/components/ProxyDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface TLSSectionProps {
  control: Control<ProxyFormValues>;
  acmeEmail?: string;
}

export function TLSSection({ control, acmeEmail }: TLSSectionProps) {
  const {
    formState: { errors },
  } = useFormContext<ProxyFormValues>();
  const tlsEnabled = useWatch({ control, name: 'tls.enabled' });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Controller
          control={control}
          name="tls.enabled"
          render={({ field }) => (
            <Switch id="tls-enabled" checked={field.value} onCheckedChange={field.onChange} />
          )}
        />
        <Label htmlFor="tls-enabled">Enable TLS (Let&apos;s Encrypt)</Label>
      </div>

      {tlsEnabled && (
        <div className="space-y-1">
          <Label htmlFor="tls-email">ACME Email</Label>
          <Controller
            control={control}
            name="tls.email"
            render={({ field }) => (
              <Input
                {...field}
                id="tls-email"
                type="email"
                placeholder="you@example.com"
                disabled={!!acmeEmail}
              />
            )}
          />
          {errors.tls?.email && (
            <p className="text-destructive text-xs">{errors.tls.email.message}</p>
          )}
          {!!acmeEmail && (
            <p className="text-muted-foreground text-xs">Set via ACME_EMAIL environment variable</p>
          )}
        </div>
      )}
    </div>
  );
}
