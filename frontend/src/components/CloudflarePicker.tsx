import { useEffect } from 'react';
import type { Control } from 'react-hook-form';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import type { ProxyFormValues } from '@/components/ProxyDialog';
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
import { useCloudflareRecords, useCloudflareZones } from '@/hooks/useCloudflare';

interface CloudflarePickerProps {
  control: Control<ProxyFormValues>;
  editMode?: boolean;
}

export function CloudflarePicker({ control, editMode }: CloudflarePickerProps) {
  const {
    setValue,
    formState: { errors },
  } = useFormContext<ProxyFormValues>();
  const zones = useCloudflareZones();

  const zoneId = useWatch({ control, name: 'cloudflare.zoneId' });
  const recordChoice = useWatch({ control, name: 'cloudflare.recordChoice' });
  const domain = useWatch({ control, name: 'domain' });

  const records = useCloudflareRecords(zoneId || null);
  const aRecords = records.data?.filter((r) => r.type === 'A') ?? [];

  // Auto-select first zone when zones load and nothing is selected yet
  useEffect(() => {
    if (zones.data && zones.data.length > 0 && !zoneId) {
      setValue('cloudflare.zoneId', zones.data[0].id);
    }
  }, [zones.data, zoneId, setValue]);

  const selectedZoneName = zones.data?.find((z) => z.id === zoneId)?.name;

  const duplicateExists =
    recordChoice === 'new' &&
    !!domain &&
    !!zoneId &&
    aRecords.some((r) => r.name === domain || r.name === `${domain}.`);

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="cf-zone">Cloudflare Zone</Label>
        {zones.isLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : zones.isError ? (
          <p className="text-destructive text-xs">Failed to load zones</p>
        ) : (
          <Controller
            control={control}
            name="cloudflare.zoneId"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={(v) => {
                  field.onChange(v);
                  setValue('cloudflare.recordId', undefined);
                }}
              >
                <SelectTrigger id="cf-zone">
                  <SelectValue placeholder="Select a zone">
                    {selectedZoneName ?? zoneId}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="min-w-[var(--radix-select-trigger-width)] w-auto max-w-sm">
                  {zones.data?.map((z) => (
                    <SelectItem key={z.id} value={z.id}>
                      {z.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
        {errors.cloudflare?.zoneId && (
          <p className="text-destructive text-xs">{errors.cloudflare.zoneId.message}</p>
        )}
      </div>

      {editMode && (
        <p className="text-muted-foreground text-xs">
          Changing the zone will delete the existing DNS record and create a new one.
        </p>
      )}

      <div className="space-y-2">
        <Label>DNS Record</Label>
        <Controller
          control={control}
          name="cloudflare.recordChoice"
          render={({ field }) => (
            <RadioGroup value={field.value} onValueChange={field.onChange} className="space-y-1">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="new" id="record-new" />
                <Label htmlFor="record-new" className="font-normal cursor-pointer">
                  Create new A record
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="existing" id="record-existing" />
                <Label htmlFor="record-existing" className="font-normal cursor-pointer">
                  Use existing record
                </Label>
              </div>
            </RadioGroup>
          )}
        />
      </div>

      {recordChoice === 'existing' && (
        <div className="space-y-1">
          <Label htmlFor="cf-record">Existing A Record</Label>
          {!zoneId ? (
            <p className="text-muted-foreground text-xs">Select a zone first</p>
          ) : records.isLoading ? (
            <Skeleton className="h-9 w-full" />
          ) : (
            <Controller
              control={control}
              name="cloudflare.recordId"
              render={({ field }) => {
                const selectedRecord = aRecords.find((r) => r.id === (field.value ?? ''));
                return (
                  <Select
                    value={field.value ?? ''}
                    onValueChange={(id) => {
                      field.onChange(id);
                      const record = aRecords.find((r) => r.id === id);
                      if (record) setValue('domain', record.name);
                    }}
                  >
                    <SelectTrigger id="cf-record">
                      <SelectValue placeholder="Select a record">
                        {selectedRecord
                          ? `${selectedRecord.name} → ${selectedRecord.content}`
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="min-w-[var(--radix-select-trigger-width)] w-auto max-w-sm">
                      {aRecords.length === 0 ? (
                        <SelectItem value="_none" disabled>
                          No A records found
                        </SelectItem>
                      ) : (
                        aRecords.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.name} → {r.content}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                );
              }}
            />
          )}
          {errors.cloudflare?.recordId && (
            <p className="text-destructive text-xs">{errors.cloudflare.recordId.message}</p>
          )}
        </div>
      )}

      {duplicateExists && (
        <p className="text-amber-600 text-xs">
          Warning: an A record for <strong>{domain}</strong> already exists in this zone. Creating a
          new one may conflict or overwrite it.
        </p>
      )}

      {recordChoice === 'new' && (
        <p className="text-muted-foreground text-xs">
          A new DNS A record will be created in the selected zone.
        </p>
      )}
    </div>
  );
}
