import type { Control } from 'react-hook-form'
import { Controller, useFormContext } from 'react-hook-form'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useDockerContainers } from '@/hooks/useDockerContainers'
import { useTailscaleNodes } from '@/hooks/useTailscaleNodes'
import type { ProxyFormValues } from '@/components/ProxyDialog'

interface UpstreamPickerProps {
  control: Control<ProxyFormValues>
}

export function UpstreamPicker({ control }: UpstreamPickerProps) {
  const { register, setValue, watch, formState: { errors } } = useFormContext<ProxyFormValues>()
  const upstreamType = watch('upstream.type')

  const containers = useDockerContainers()
  const nodes = useTailscaleNodes()

  function handleTabChange(type: 'docker' | 'tailscale' | 'manual') {
    setValue('upstream.type', type)
    setValue('upstream.ref', '')
    setValue('upstream.port', 80)
  }

  return (
    <div className="space-y-2">
      <Label>Upstream</Label>
      <Tabs value={upstreamType} onValueChange={(v) => handleTabChange(v as 'docker' | 'tailscale' | 'manual')}>
        <TabsList className="w-full">
          <TabsTrigger value="docker" className="flex-1">Docker</TabsTrigger>
          <TabsTrigger value="tailscale" className="flex-1">Tailscale</TabsTrigger>
          <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
        </TabsList>

        <TabsContent value="docker" className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="docker-ref">Container</Label>
            {containers.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : containers.isError ? (
              <p className="text-destructive text-xs">Failed to load containers</p>
            ) : (
              <Controller
                control={control}
                name="upstream.ref"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(name) => {
                      field.onChange(name)
                      const container = containers.data?.find((c) => c.name === name)
                      const port = container?.ports[0]?.internal ?? 80
                      setValue('upstream.port', port)
                    }}
                  >
                    <SelectTrigger id="docker-ref">
                      <SelectValue placeholder="Select a container" />
                    </SelectTrigger>
                    <SelectContent>
                      {containers.data?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name} <span className="text-muted-foreground ml-1 text-xs">({c.image})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {errors.upstream?.ref && (
              <p className="text-destructive text-xs">{errors.upstream.ref.message}</p>
            )}
          </div>
          <PortField register={register} errors={errors} />
        </TabsContent>

        <TabsContent value="tailscale" className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="ts-ref">Node</Label>
            {nodes.isLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : nodes.isError ? (
              <p className="text-destructive text-xs">Failed to load Tailscale nodes</p>
            ) : (
              <Controller
                control={control}
                name="upstream.ref"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="ts-ref">
                      <SelectValue placeholder="Select a node" />
                    </SelectTrigger>
                    <SelectContent>
                      {nodes.data?.map((n) => (
                        <SelectItem key={n.id} value={n.hostname}>
                          {n.hostname}
                          <span className={`ml-2 text-xs ${n.online ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {n.online ? '● online' : '○ offline'}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
            {errors.upstream?.ref && (
              <p className="text-destructive text-xs">{errors.upstream.ref.message}</p>
            )}
          </div>
          <PortField register={register} errors={errors} />
        </TabsContent>

        <TabsContent value="manual" className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label htmlFor="manual-ref">Host or IP</Label>
            <Input id="manual-ref" placeholder="192.168.1.10" {...register('upstream.ref')} />
            {errors.upstream?.ref && (
              <p className="text-destructive text-xs">{errors.upstream.ref.message}</p>
            )}
          </div>
          <PortField register={register} errors={errors} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function PortField({
  register,
  errors,
}: {
  register: ReturnType<typeof useFormContext<ProxyFormValues>>['register']
  errors: ReturnType<typeof useFormContext<ProxyFormValues>>['formState']['errors']
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor="upstream-port">Port</Label>
      <Input
        id="upstream-port"
        type="number"
        min={1}
        max={65535}
        {...register('upstream.port', { valueAsNumber: true })}
      />
      {errors.upstream?.port && (
        <p className="text-destructive text-xs">{errors.upstream.port.message}</p>
      )}
    </div>
  )
}
