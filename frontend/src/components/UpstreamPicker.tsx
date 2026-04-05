import { useEffect, useState } from 'react';
import type { Control } from 'react-hook-form';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { ProxyFormValues } from '@/components/ProxyDialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDockerContainers } from '@/hooks/useDockerContainers';
import { useExternalIps } from '@/hooks/useExternalIps';
import { useTailscaleNodes } from '@/hooks/useTailscaleNodes';
import type { ContainerInfo } from '@/types';

interface UpstreamPickerProps {
  control: Control<ProxyFormValues>;
}

export function UpstreamPicker({ control }: UpstreamPickerProps) {
  const {
    register,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext<ProxyFormValues>();
  const upstreamType = watch('upstream.type');

  const containers = useDockerContainers();
  const nodes = useTailscaleNodes();

  function handleTabChange(type: 'docker' | 'tailscale' | 'manual') {
    setValue('upstream.type', type);
    setValue('upstream.ref', '');
    setValue('upstream.port', 80);
    setValue('upstream.publicIp', '');
  }

  const selectedContainerName = useWatch({ control, name: 'upstream.ref' });
  const selectedContainer =
    upstreamType === 'docker'
      ? containers.data?.find((c) => c.name === selectedContainerName)
      : undefined;

  return (
    <div className="space-y-2">
      <Label>Upstream</Label>
      <Tabs
        value={upstreamType}
        onValueChange={(v) => handleTabChange(v as 'docker' | 'tailscale' | 'manual')}
      >
        <TabsList className="w-full">
          <TabsTrigger value="docker" className="flex-1">
            Docker
          </TabsTrigger>
          <TabsTrigger value="tailscale" className="flex-1">
            Tailscale
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex-1">
            Manual
          </TabsTrigger>
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
                      field.onChange(name);
                      const container = containers.data?.find((c) => c.name === name);
                      setValue('upstream.port', container?.ports[0]?.internal ?? 80);
                    }}
                  >
                    <SelectTrigger id="docker-ref">
                      <SelectValue placeholder="Select a container" />
                    </SelectTrigger>
                    <SelectContent className="min-w-[var(--radix-select-trigger-width)] w-auto max-w-md">
                      {containers.data?.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}{' '}
                          <span className="text-muted-foreground ml-1 text-xs">({c.image})</span>
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
          <DockerPortField
            container={selectedContainer}
            control={control}
            register={register}
            errors={errors}
            setValue={setValue}
          />
          <DockerPublicEndpoint control={control} setValue={setValue} containerName={selectedContainerName} />
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
                    <SelectContent className="min-w-[var(--radix-select-trigger-width)] w-auto max-w-md">
                      {nodes.data?.map((n) => (
                        <SelectItem key={n.id} value={n.hostname}>
                          {n.name}
                          <span
                            className={`ml-2 text-xs ${n.online ? 'text-green-600' : 'text-muted-foreground'}`}
                          >
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
  );
}

function DockerPortField({
  container,
  control,
  register,
  errors,
  setValue,
}: {
  container: ContainerInfo | undefined;
  control: Control<ProxyFormValues>;
  register: ReturnType<typeof useFormContext<ProxyFormValues>>['register'];
  errors: ReturnType<typeof useFormContext<ProxyFormValues>>['formState']['errors'];
  setValue: ReturnType<typeof useFormContext<ProxyFormValues>>['setValue'];
}) {
  const [useCustomPort, setUseCustomPort] = useState(false);
  const portValue = useWatch({ control, name: 'upstream.port' });
  const ports = container?.ports ?? [];
  const containerName = container?.name;

  // biome-ignore lint/correctness/useExhaustiveDependencies: containerName is intentional — resets state when the selected container changes
  useEffect(() => {
    setUseCustomPort(false);
  }, [containerName]);

  if (ports.length === 1) {
    return (
      <div className="space-y-1">
        <Label>Port</Label>
        <p className="text-sm font-mono bg-muted rounded px-2 py-1 inline-block">
          {ports[0].internal}
        </p>
      </div>
    );
  }

  if (ports.length > 1) {
    return (
      <div className="space-y-1">
        <Label htmlFor="docker-port">Port</Label>
        <Select
          value={useCustomPort ? '__custom__' : String(portValue)}
          onValueChange={(v) => {
            if (v === '__custom__') {
              setUseCustomPort(true);
            } else {
              setUseCustomPort(false);
              setValue('upstream.port', Number(v));
            }
          }}
        >
          <SelectTrigger id="docker-port">
            <SelectValue placeholder="Select a port" />
          </SelectTrigger>
          <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
            {ports.map((p) => (
              <SelectItem key={p.internal} value={String(p.internal)}>
                {p.internal}
                {p.external ? ` (→ ${p.external} on host)` : ''}
              </SelectItem>
            ))}
            <SelectItem value="__custom__">Custom…</SelectItem>
          </SelectContent>
        </Select>
        {useCustomPort && (
          <Input
            id="upstream-port"
            type="number"
            min={1}
            max={65535}
            placeholder="Port number"
            {...register('upstream.port', { valueAsNumber: true })}
          />
        )}
        {errors.upstream?.port && (
          <p className="text-destructive text-xs">{errors.upstream.port.message}</p>
        )}
      </div>
    );
  }

  return <PortField register={register} errors={errors} />;
}

function PortField({
  register,
  errors,
}: {
  register: ReturnType<typeof useFormContext<ProxyFormValues>>['register'];
  errors: ReturnType<typeof useFormContext<ProxyFormValues>>['formState']['errors'];
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
  );
}

function DockerPublicEndpoint({
  control,
  setValue,
  containerName,
}: {
  control: Control<ProxyFormValues>;
  setValue: ReturnType<typeof useFormContext<ProxyFormValues>>['setValue'];
  containerName: string;
}) {
  const externalIps = useExternalIps();
  const publicIp = useWatch({ control, name: 'upstream.publicIp' });
  const { errors } = useFormContext<ProxyFormValues>().formState;

  // biome-ignore lint/correctness/useExhaustiveDependencies: containerName is intentional — resets selection when container changes
  useEffect(() => {
    setValue('upstream.publicIp', '');
  }, [containerName]);

  return (
    <div className="space-y-1">
      <Label>Public endpoint (for DNS)</Label>
      {externalIps.isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : (
        <RadioGroup
          value={publicIp ?? ''}
          onValueChange={(v) => setValue('upstream.publicIp', v)}
          className="gap-2"
        >
          <div
            className={`flex items-center gap-2 rounded border px-3 py-2 ${!externalIps.data?.tailscale ? 'opacity-40' : ''}`}
          >
            <RadioGroupItem
              id="public-tailscale"
              value={externalIps.data?.tailscale ?? ''}
              disabled={!externalIps.data?.tailscale}
            />
            <Label htmlFor="public-tailscale" className="cursor-pointer font-normal">
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
              id="public-ip"
              value={externalIps.data?.public ?? ''}
              disabled={!externalIps.data?.public}
            />
            <Label htmlFor="public-ip" className="cursor-pointer font-normal">
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
