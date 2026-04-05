# Plan 3: UpstreamPicker & TLS UX Improvements

**TODO items:** #2, #6, #7

---

## Overview

Three improvements to the upstream and TLS sections of the proxy dialog:

| # | Item |
|---|---|
| 2 | Container dropdown: make it wide enough to show the full container name + image |
| 6 | TLS toggle: display the configured `ACME_EMAIL` address when available |
| 7 | Docker port selection: smart port field — single port auto-fills, multi-port shows dropdown, custom always available |

---

## Item #2 — Container Dropdown Width

### Problem

`SelectContent` is constrained to the trigger width by default in Radix. Container names combined with image labels (e.g. `my-long-container-name (nginx:latest)`) get cut off.

### File: `frontend/src/components/UpstreamPicker.tsx`

### Solution

Apply the same Radix CSS variable trick used in Plan 2 to both the container dropdown and the Tailscale node dropdown:

```tsx
<SelectContent className="min-w-[var(--radix-select-trigger-width)] w-auto max-w-md">
```

`max-w-md` (28rem / 448px) caps the width at a reasonable maximum so it doesn't overflow the dialog on narrow viewports.

---

## Item #6 — Show ACME_EMAIL in TLS Section

### Problem

When the user toggles "Enable TLS", an email input appears. The form is pre-filled with `config.acmeEmail` (fetched from `/api/config`) via `ProxyDialog.useEffect`. However, the user has no visual indication of where the email came from or that it is the globally configured ACME email. They may clear it by accident or be confused when editing a proxy that has a different email.

### File: `frontend/src/components/TLSSection.tsx`

### Solution

`TLSSection` currently receives only `control`. Pass `acmeEmail` (the value from the config endpoint) as an additional prop so the component can show a contextual hint:

**Updated prop interface:**

```ts
interface TLSSectionProps {
  control: Control<ProxyFormValues>
  acmeEmail?: string
}
```

**In `ProxyDialog.tsx`**, pass the value:

```tsx
<TLSSection control={form.control} acmeEmail={config?.acmeEmail} />
```

**In `TLSSection.tsx`**, watch the current email value and compare:

```ts
const currentEmail = useWatch({ control, name: 'tls.email' })
const showConfigHint = !!acmeEmail && !currentEmail
const showMatchHint = !!acmeEmail && currentEmail === acmeEmail
```

Render below the email input:

```tsx
{showConfigHint && (
  <p className="text-muted-foreground text-xs">
    Configured ACME email: <span className="font-mono">{acmeEmail}</span>
  </p>
)}
{showMatchHint && (
  <p className="text-muted-foreground text-xs">
    Using configured ACME email
  </p>
)}
```

- When email field is empty and ACME_EMAIL is set → show the configured value as a hint so the user knows what will be used if they leave it blank (or keep the pre-fill).
- When the email matches the configured value → reassure the user they're using the system default.
- When the user has typed a custom email → no hint (they've made a deliberate choice).

---

## Item #7 — Smart Port Field for Docker Containers

### Problem

Currently the port field is always a free-text number input. When a container exposes exactly one port (the common case), the user is forced to confirm a port that was already auto-filled. When a container exposes multiple ports, the user must remember or look up the correct internal port number.

### File: `frontend/src/components/UpstreamPicker.tsx`

### Behavior Spec

| Container's exposed ports | Port UI |
|---|---|
| 0 ports | Free-text input (no hints) |
| 1 port | Inline read-only badge showing the port; no input needed (port is auto-set on container selection) |
| 2+ ports | Dropdown of internal ports, **plus** a "Custom…" option that reveals a text input |

### Implementation

**Rename and expand `PortField`** to `DockerPortField`, receiving the currently selected container as a prop:

```ts
interface DockerPortFieldProps {
  container: ContainerInfo | undefined
  register: ...
  control: Control<ProxyFormValues>
  errors: ...
  setValue: UseFormSetValueFn
}
```

**Single port (1 exposed):** show as a labeled read-only display:

```tsx
if (ports.length === 1) {
  return (
    <div className="space-y-1">
      <Label>Port</Label>
      <p className="text-sm font-mono bg-muted rounded px-2 py-1 inline-block">
        {ports[0].internal}
      </p>
    </div>
  )
}
```

The port was already set in `onValueChange` when the container was selected.

**Multiple ports:** dropdown with a "Custom" entry:

```tsx
const [useCustomPort, setUseCustomPort] = useState(false)

// ports dropdown
<Select
  value={useCustomPort ? '__custom__' : String(portValue)}
  onValueChange={(v) => {
    if (v === '__custom__') {
      setUseCustomPort(true)
    } else {
      setUseCustomPort(false)
      setValue('upstream.port', Number(v))
    }
  }}
>
  <SelectContent className="min-w-[var(--radix-select-trigger-width)]">
    {ports.map((p) => (
      <SelectItem key={p.internal} value={String(p.internal)}>
        {p.internal}{p.external ? ` (→ ${p.external} on host)` : ''}
      </SelectItem>
    ))}
    <SelectItem value="__custom__">Custom…</SelectItem>
  </SelectContent>
</Select>

{useCustomPort && (
  <Input type="number" min={1} max={65535}
    {...register('upstream.port', { valueAsNumber: true })} />
)}
```

**No ports:** fall through to the existing free-text `PortField` unchanged.

**Reset `useCustomPort`** when the selected container changes (inside the `onValueChange` of the container `Select`):

```ts
onValueChange={(name) => {
  field.onChange(name)
  setUseCustomPort(false)
  const container = containers.data?.find((c) => c.name === name)
  setValue('upstream.port', container?.ports[0]?.internal ?? 80)
}}
```

### State Management Note

`useCustomPort` is local to the `DockerPortField` component. It should be lifted into the `TabsContent value="docker"` block or passed via prop so it resets when the user switches tabs or selects a different container. The cleanest approach is to keep it as a `useState` inside `DockerPortField` and reset it via a `useEffect` keyed on the container name:

```ts
useEffect(() => {
  setUseCustomPort(false)
}, [container?.name])
```

---

## Files to Edit

| File | Change |
|---|---|
| `frontend/src/components/UpstreamPicker.tsx` | Wider dropdowns; expand `PortField` → `DockerPortField` with smart port logic |
| `frontend/src/components/TLSSection.tsx` | Accept `acmeEmail` prop; show hint when TLS toggled on |
| `frontend/src/components/ProxyDialog.tsx` | Pass `acmeEmail={config?.acmeEmail}` to `TLSSection` |

---

## Edge Cases

- **Container with no port information** (e.g. network-only containers): falls back to the manual text input with default `80`.
- **Port resets on tab switch:** `handleTabChange` already calls `setValue('upstream.port', 80)`, which is correct. `useCustomPort` is local to `DockerPortField` and unmounts with the tab.
- **Edit mode (proxy already exists):** The port field will be pre-populated from the saved value. If the container exposes multiple ports, the dropdown should default to the saved port — the `value` prop on the `Select` is driven by the form value, so this is handled automatically.
- **ACME email not configured:** `acmeEmail` prop is `undefined`; no hints are shown and behavior is unchanged from current.
