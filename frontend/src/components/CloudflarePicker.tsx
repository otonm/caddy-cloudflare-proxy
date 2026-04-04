import type { Control } from 'react-hook-form'
import { Controller, useFormContext, useWatch } from 'react-hook-form'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useCloudflareRecords, useCloudflareZones } from '@/hooks/useCloudflare'
import type { ProxyFormValues } from '@/components/ProxyDialog'

interface CloudflarePickerProps {
  control: Control<ProxyFormValues>
  editMode?: boolean
}

export function CloudflarePicker({ control, editMode }: CloudflarePickerProps) {
  const { setValue, formState: { errors } } = useFormContext<ProxyFormValues>()
  const zones = useCloudflareZones()

  const zoneId = useWatch({ control, name: 'cloudflare.zoneId' })
  const recordChoice = useWatch({ control, name: 'cloudflare.recordChoice' })

  const records = useCloudflareRecords(recordChoice === 'existing' ? zoneId : null)
  const aRecords = records.data?.filter((r) => r.type === 'A') ?? []

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
                  field.onChange(v)
                  setValue('cloudflare.recordId', undefined)
                }}
              >
                <SelectTrigger id="cf-zone">
                  <SelectValue placeholder="Select a zone" />
                </SelectTrigger>
                <SelectContent>
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
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger id="cf-record">
                    <SelectValue placeholder="Select a record" />
                  </SelectTrigger>
                  <SelectContent>
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
              )}
            />
          )}
          {errors.cloudflare?.recordId && (
            <p className="text-destructive text-xs">{errors.cloudflare.recordId.message}</p>
          )}
        </div>
      )}

      {recordChoice === 'new' && (
        <p className="text-muted-foreground text-xs">
          A new DNS A record will be created in the selected zone.
        </p>
      )}
    </div>
  )
}
