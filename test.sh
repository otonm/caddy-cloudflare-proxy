#!/usr/bin/env bash
# test.sh — integration tests for caddy-cloudflare-proxy
# Run from project root: bash test.sh
# Requires: node + npm install already run

# ── Colours ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BOLD='\033[1m'
RESET='\033[0m'

# ── State ──────────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
SERVER_PID=""
TEST_PORT=3099   # use a non-standard port so we don't collide with a running dev server

# ── Helpers ────────────────────────────────────────────────────────────────────
pass()    { echo -e "  ${GREEN}✓${RESET} $1"; PASS=$((PASS + 1)); }
fail()    { echo -e "  ${RED}✗${RESET} $1"; FAIL=$((FAIL + 1)); }
section() { echo -e "\n${BOLD}$1${RESET}"; }

stop_server() {
  # Kill tracked process and its children (tsx spawns a child node process)
  if [[ -n "$SERVER_PID" ]]; then
    pkill -9 -P "$SERVER_PID" 2>/dev/null || true
    kill -9 "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
  # Also kill anything still listening on the test port (orphans from prior runs)
  local pid
  pid=$(ss -tlnp "sport = :${TEST_PORT}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
  if [[ -n "$pid" ]]; then
    kill -9 "$pid" 2>/dev/null || true
  fi
  sleep 0.2   # let OS release the port
}

cleanup() { stop_server; }
trap cleanup EXIT

# Start the backend, wait until /api/health responds (max 5s).
# Usage: start_server VAR=value VAR=value ...
start_server() {
  stop_server
  env "$@" \
    APP_PORT="$TEST_PORT" \
    CF_API_TOKEN="${CF_API_TOKEN:-test-token}" \
    TS_API_KEY="${TS_API_KEY:-test-key}" \
    TS_TAILNET="${TS_TAILNET:-test-tailnet}" \
    ACME_EMAIL="${ACME_EMAIL:-test@example.com}" \
    node_modules/.bin/tsx backend/src/index.ts \
    > /tmp/server.log 2>&1 &
  SERVER_PID=$!

  local retries=0
  until curl -sf "http://localhost:${TEST_PORT}/api/health" > /dev/null 2>&1; do
    sleep 0.2
    retries=$((retries + 1))
    if (( retries > 25 )); then
      echo -e "  ${RED}Server failed to start. Log:${RESET}"
      cat /tmp/server.log
      return 1
    fi
    # If the process already died, bail early
    if ! kill -0 "$SERVER_PID" 2>/dev/null; then
      echo -e "  ${RED}Server process died. Log:${RESET}"
      cat /tmp/server.log
      return 1
    fi
  done
}

assert_status() {
  local desc="$1" expected="$2"
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${TEST_PORT}/$3")
  if [[ "$actual" == "$expected" ]]; then
    pass "$desc"
  else
    fail "$desc (expected $expected, got $actual)"
  fi
}

assert_body() {
  local desc="$1" pattern="$2"
  local body
  body=$(curl -s "http://localhost:${TEST_PORT}/$3")
  if echo "$body" | grep -qF "$pattern"; then
    pass "$desc"
  else
    fail "$desc (expected '$pattern' in body, got: $body)"
  fi
}

# ── Tests ──────────────────────────────────────────────────────────────────────

section "Step 1 — Foundation"

# ──────────────────────────────────────────────────────────────────────────────
section "  1.1  Env var validation"

_test_missing_var() {
  local var="$1"
  local args=()
  for v in CF_API_TOKEN TS_API_KEY TS_TAILNET ACME_EMAIL; do
    [[ "$v" == "$var" ]] && args+=("${v}=") || args+=("${v}=x")
  done
  local out
  out=$(env "${args[@]}" APP_PORT=$TEST_PORT \
    node_modules/.bin/tsx backend/src/index.ts 2>&1 || true)
  if echo "$out" | grep -qF "Missing required env var: $var"; then
    pass "Refuses to start without $var"
  else
    fail "Should reject missing $var (got: $out)"
  fi
}

_test_missing_var CF_API_TOKEN
_test_missing_var TS_API_KEY
_test_missing_var TS_TAILNET
_test_missing_var ACME_EMAIL

# ──────────────────────────────────────────────────────────────────────────────
section "  1.2  Health endpoint (auth disabled)"

start_server DISABLE_AUTH=true

assert_status "GET /api/health → 200" "200" "api/health"
assert_body   "Body contains ok:true"  '"ok":true' "api/health"

# ──────────────────────────────────────────────────────────────────────────────
section "  1.3  Auth disabled — routes pass through"

# Auth disabled: non-existent route should get 404 (not 403)
assert_status "Non-existent route → 404 (not blocked)" "404" "api/nonexistent"

# ──────────────────────────────────────────────────────────────────────────────
section "  1.4  Auth enabled — non-Tailscale IPs blocked"

start_server DISABLE_AUTH=false

assert_status "Health still accessible with auth on → 200" "200" "api/health"
assert_status "Non-Tailscale IP blocked → 403"             "403" "api/nonexistent"
assert_body   "403 body contains Forbidden"                "Forbidden" "api/nonexistent"

# ──────────────────────────────────────────────────────────────────────────────
section "  1.5  proxyStore unit tests"

stop_server

store_out=$(env DATA_DIR="/tmp/proxy-store-test-$$" \
  node_modules/.bin/tsx --eval "
import { add, readAll, update, remove, findById } from './backend/src/store/proxyStore';

const proxy = {
  id: 'test-1',
  domain: 'app.example.com',
  upstream: { type: 'manual', ref: 'localhost', port: 8080 },
  cloudflare: { zoneId: 'zone-1', recordId: '' },
  tls: { enabled: true, email: 'test@example.com' },
  createdAt: new Date().toISOString(),
};

(async () => {
  const empty = await readAll();
  if (empty.length !== 0) throw new Error('Expected empty store, got ' + empty.length);
  console.log('empty store ok');

  await add(proxy);
  const all = await readAll();
  if (all.length !== 1) throw new Error('Expected 1 proxy after add, got ' + all.length);
  console.log('add ok');

  const found = await findById('test-1');
  if (!found || found.domain !== 'app.example.com') throw new Error('findById failed');
  console.log('findById ok');

  await update('test-1', { domain: 'updated.example.com' });
  const updated = await findById('test-1');
  if (!updated || updated.domain !== 'updated.example.com') throw new Error('update failed');
  console.log('update ok');

  await remove('test-1');
  const after = await readAll();
  if (after.length !== 0) throw new Error('Expected empty after remove, got ' + after.length);
  console.log('remove ok');
})().catch(e => { process.stderr.write('FAIL: ' + e.message + '\n'); process.exit(1); });
" 2>&1)

while IFS= read -r line; do
  [[ -z "$line" ]] && continue
  case "$line" in
    *FAIL*) fail "proxyStore — ${line#FAIL: }" ;;
    *ok)    pass "proxyStore — ${line% ok}" ;;
    *)      : ;;
  esac
done <<< "$store_out"

rm -rf "/tmp/proxy-store-test-$$"

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
if (( FAIL > 0 )); then
  echo -e "${BOLD}Results: ${GREEN}${PASS} passed${RESET}${BOLD}, ${RED}${FAIL} failed${RESET}"
  exit 1
else
  echo -e "${BOLD}Results: ${GREEN}${PASS} passed, 0 failed${RESET}"
fi
