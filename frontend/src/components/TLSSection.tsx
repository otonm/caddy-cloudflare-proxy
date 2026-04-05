import type { Control } from 'react-hook-form'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import type { ProxyFormValues } from '@/components/ProxyDialog'

interface TLSSectionProps {
  control: Control<ProxyFormValues>
  acmeEmail?: string
}

export function TLSSection({ control, acmeEmail }: TLSSectionProps) {
  const { register, formState: { errors } } = useFormContext<ProxyFormValues>()
  const tlsEnabled = useWatch({ control, name: 'tls.enabled' })
  const currentEmail = useWatch({ control, name: 'tls.email' })
  const showConfigHint = !!acmeEmail && !currentEmail
  const showMatchHint = !!acmeEmail && currentEmail === acmeEmail

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Controller
          control={control}
          name="tls.enabled"
          render={({ field }) => (
            <Switch
              id="tls-enabled"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Label htmlFor="tls-enabled">Enable TLS (Let&apos;s Encrypt)</Label>
      </div>

      {tlsEnabled && (
        <div className="space-y-1">
          <Label htmlFor="tls-email">ACME Email</Label>
          <Input
            id="tls-email"
            type="email"
            placeholder="you@example.com"
            {...register('tls.email')}
          />
          {errors.tls?.email && (
            <p className="text-destructive text-xs">{errors.tls.email.message}</p>
          )}
          {showConfigHint && (
            <p className="text-muted-foreground text-xs">
              Configured ACME email: <span className="font-mono">{acmeEmail}</span>
            </p>
          )}
          {showMatchHint && (
            <p className="text-muted-foreground text-xs">Using configured ACME email</p>
          )}
        </div>
      )}
    </div>
  )
}
