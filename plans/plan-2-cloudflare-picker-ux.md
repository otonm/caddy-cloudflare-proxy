# Plan 2: CloudflarePicker UX Improvements

**TODO items:** #3, #4, #5

---

## Overview

Three related improvements to `frontend/src/components/CloudflarePicker.tsx`:

| # | Item |
|---|---|
| 3 | Zone dropdown: auto-select the first available zone; show zone name (not ID) in trigger |
| 4 | "Create new A record": check if a record for the entered domain already exists and show a warning |
| 5 | A records dropdown: make it wide enough to display the full record name |

---

## Item #3 — Zone Auto-Select & Name Display

### Problem

Two related issues:

**Auto-select:** When the dialog opens on an "add proxy" flow, the zone dropdown starts empty and the user must manually pick a zone even when they only have one. This is unnecessary friction.

**Name display in trigger:** The Radix `Select` component shows the text content of the matching `SelectItem` as the trigger label. This works correctly for newly selected items, but when a proxy is loaded for editing, `zoneId` is pre-populated with a raw UUID. Because the zones haven't necessarily loaded yet at `useEffect` time, the trigger may briefly render the raw ID string before zones arrive — and if `CloudflarePicker` is not yet mounted, the displayed value never gets resolved to a name. The trigger should always show the human-readable zone name.

### Solution

**Auto-select:** In `CloudflarePicker`, add a `useEffect` that fires when `zones.data` arrives and the `zoneId` field is still empty. Set `zoneId` to `zones.data[0].id`.

```ts
useEffect(() => {
  if (zones.data && zones.data.length > 0 && !zoneId) {
    setValue('cloudflare.zoneId', zones.data[0].id)
  }
}, [zones.data])
```

**Name display:** Instead of relying on `SelectValue` to pick up the text from the `SelectItem`, derive the display name explicitly and pass it as `placeholder` fallback. Add a local lookup:

```ts
const selectedZoneName = zones.data?.find((z) => z.id === zoneId)?.name
```

Then in the trigger:

```tsx
<SelectTrigger id="cf-zone">
  <SelectValue placeholder="Select a zone">
    {selectedZoneName ?? zoneId}
  </SelectValue>
</SelectTrigger>
```

This ensures the name is shown even before zones finish loading when editing.

---

## Item #4 — Warn When "Create New A Record" Duplicates an Existing Record

### Problem

When the user chooses "Create new A record" and types a domain that already has an A record in the selected zone, the form silently proceeds and the Cloudflare API will either reject it or create a duplicate. The user should be warned before submit.

### Solution

**Load records eagerly when zone is selected** — currently `useCloudflareRecords` is only called when `recordChoice === 'existing'`. Change the hook call to always run when a zone is selected:

```ts
const records = useCloudflareRecords(zoneId || null)
const aRecords = records.data?.filter((r) => r.type === 'A') ?? []
```

The existing records dropdown still only renders when `recordChoice === 'existing'`, but the data is available for the duplicate check regardless.

**Watch the domain field** — `CloudflarePicker` needs access to the `domain` field from the parent form. Use `useWatch`:

```ts
const domain = useWatch({ control, name: 'domain' })
```

**Derive a warning flag:**

```ts
const duplicateExists =
  recordChoice === 'new' &&
  !!domain &&
  !!zoneId &&
  aRecords.some((r) => r.name === domain || r.name === domain + '.')
```

The trailing-dot comparison handles Cloudflare's FQDN normalization (Cloudflare stores `app.example.com.` as `app.example.com`, but it's safe to check both).

**Render the warning** below the radio group, just above the "A new DNS A record will be created" note:

```tsx
{duplicateExists && (
  <p className="text-amber-600 text-xs">
    Warning: an A record for <strong>{domain}</strong> already exists in this zone.
    Creating a new one may conflict or overwrite it.
  </p>
)}
```

---

## Item #5 — A Records Dropdown Width

### Problem

The `SelectContent` for existing A records is constrained to the width of the trigger button, which is often too narrow to show `subdomain.example.com → 1.2.3.4` in full.

### Solution

Radix `SelectContent` accepts a `className`. Add `min-w-[var(--radix-select-trigger-width)]` to ensure it is at least as wide as the trigger, plus allow it to grow:

```tsx
<SelectContent className="min-w-[var(--radix-select-trigger-width)] w-auto max-w-sm">
```

Apply the same pattern to the zone dropdown for consistency.

`--radix-select-trigger-width` is a CSS custom property injected by Radix at runtime onto the content portal so this works without JavaScript measurement.

---

## Files to Edit

| File | Change |
|---|---|
| `frontend/src/components/CloudflarePicker.tsx` | Auto-select zone, name display, duplicate warning, wider dropdowns |
| `frontend/src/hooks/useCloudflare.ts` | No change needed — `useCloudflareRecords` already accepts `null` to disable |

---

## Edge Cases

- **No zones available:** Auto-select effect does nothing; existing placeholder text renders.
- **Zone changes:** When the user picks a different zone, `zoneId` changes, records re-fetch, duplicate check re-evaluates automatically.
- **Edit mode:** The auto-select effect checks `!zoneId` so it does not override the pre-populated value when editing an existing proxy.
- **Empty domain:** `duplicateExists` is false when `domain` is empty or zone not yet chosen.
