# Plan 1: Tailscale Debugging & Error Visibility

**TODO item:** #1 — Fix error "Failed to load Tailscale nodes". Provide additional debugging information in stdout.

---

## Problem

When the Tailscale API call fails, the frontend shows "Failed to load Tailscale nodes" with no actionable information. On the backend, the error is caught and returned as a 502/500 JSON response but never logged to stdout. Operators have no way to diagnose whether the problem is a missing env var, a bad API key, a wrong tailnet slug, a network timeout, or an upstream API error.

---

## Root Cause Analysis

In `backend/src/routes/tailscale.ts`, the catch block returns the error to the client but does **not** log it:

```ts
} catch (err) {
  res.status(...).json({ error: 'Failed to list Tailscale nodes', details: ... })
}
```

In `backend/src/clients/tailscale.ts`, two failure modes produce opaque errors:
1. Missing env vars — throws `Error('TS_API_KEY and TS_TAILNET are required')`, which is clear but never surfaced in logs.
2. Non-ok HTTP response — throws `Error(\`Tailscale API error ${res.status}: ${body}\`)`, which includes the status but the raw body may be a long JSON blob that gets truncated.

---

## Changes

### 1. `backend/src/routes/tailscale.ts` — add structured stdout logging

Add a `console.error` call in every catch block so the full error is always written to the container log:

```ts
router.get('/nodes', async (_req, res) => {
  try {
    const nodes = await listDevices()
    res.json(nodes)
  } catch (err) {
    console.error('[tailscale] Failed to list nodes:', err)
    res.status(isUpstreamError(err) ? 502 : 500).json({
      error: 'Failed to list Tailscale nodes',
      details: err instanceof Error ? err.message : String(err),
    })
  }
})
```

### 2. `backend/src/clients/tailscale.ts` — improve diagnostic error messages

**Env-var guard** — include which var is missing:

```ts
const missing = ['TS_API_KEY', 'TS_TAILNET'].filter((k) => !process.env[k])
if (missing.length) throw new Error(`Missing required env vars: ${missing.join(', ')}`)
```

**HTTP error** — parse the Tailscale error response body and include the `message` field if present (Tailscale API returns `{ "message": "..." }` on errors):

```ts
if (!res.ok) {
  let detail = `HTTP ${res.status}`
  try {
    const body = await res.json() as { message?: string }
    if (body.message) detail += `: ${body.message}`
  } catch {
    // body was not JSON; ignore
  }
  throw new Error(`Tailscale API error — ${detail} (tailnet: ${tailnet})`)
}
```

The tailnet is now included in the error so operators can confirm the right slug is in use.

### 3. `backend/src/index.ts` — startup validation logging

The `start()` function already throws on missing vars, but the message is generic. Replace the required-vars check with per-var logging so the startup output clearly lists what is and isn't configured:

```ts
async function start() {
  const vars = ['CF_API_TOKEN', 'TS_API_KEY', 'TS_TAILNET', 'ACME_EMAIL']
  const missing = vars.filter((k) => !process.env[k])
  if (missing.length) {
    console.error('[startup] Missing required environment variables:', missing.join(', '))
    process.exit(1)
  }
  console.log('[startup] Config OK — CF_API_TOKEN set, TS_TAILNET =', process.env.TS_TAILNET, ', ACME_EMAIL =', process.env.ACME_EMAIL)
  // ... rest unchanged
}
```

This gives operators a clear startup line to verify configuration without exposing secret values (only the tailnet and email are logged, not the tokens themselves).

---

## Files to Edit

| File | Change |
|---|---|
| `backend/src/routes/tailscale.ts` | Add `console.error` in catch block |
| `backend/src/clients/tailscale.ts` | Better env-var and HTTP error messages |
| `backend/src/index.ts` | Per-var startup logging, mask token values |

---

## Testing

1. Start the container without `TS_API_KEY` set → expect startup to log the missing var and exit.
2. Start with a wrong `TS_API_KEY` → expect the `/api/tailscale/nodes` request to log a clear Tailscale API error in docker logs.
3. Start with a wrong `TS_TAILNET` slug → expect error to include the tailnet value that was used.
4. Happy path: correct credentials → nodes returned, no error logs.
