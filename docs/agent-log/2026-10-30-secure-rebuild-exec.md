# Secure rebuild execution log

## [14:45] Task 1 — vitest harness

- **Action:** `npm install -D --save-exact vitest@3` (3.2.7); added `vitest.config.ts`, smoke test, `test`/`typecheck` scripts.
- **Why:** Hard Stop (dependency install) pre-approved by Leo; tests are first-class code.
- **Result:** `npm test` 1 passed; `npm run typecheck` baseline 0 errors. npm also pruned a dangling `@dataconnect/generated` link from package-lock.json (target dir absent).
- **Lesson:** `server-only` throws outside Next's bundler, so tests alias it to Next's empty stub. Lockfile churn from a plain install can hide unrelated cleanup; check `git diff --stat`.

## [14:52] Task 2 — command allowlist + telemetry parser

- **Action:** added `src/lib/control/commands.ts`, `src/lib/telemetry/{parseStatus,fixtures}.ts` and tests (tests first; RED = "Cannot find module" for both).
- **Why:** one shared allowlist matching `VALID_COMMANDS` in ai-receiver/main.py; one parser so `0` is a reading and missing is `null` (old UI used `Number(x ?? 0)`).
- **Result:** 39 tests pass, typecheck 0 errors. Fixtures are derived from code, not captured from a broker.
- **Lesson:** `Number("")` and `Number(null)` are 0, so `num()` must reject empty strings and non-number/string types before coercing.

## [14:50] Task 3 — shared pg pool + auth schema

- **Action:** added `src/lib/db.ts` (server-only, globalThis-cached Pool in non-prod), `db/migrations/001_auth.sql`; both water-level routes now import `db`.
- **Why:** one pool instead of one per route; auth tables needed by later tasks. Migration NOT run (Hard Stop: DB migration, Leo owns it).
- **Result:** typecheck 0 errors, `npm test` passes, `npm run build` succeeds. No local Postgres, so GET /api/water-level not exercised live; response bodies/status codes untouched.
- **Lesson:** a module-level Pool is recreated on every HMR reload in dev unless cached on globalThis.

## [14:52] Task 4 — passwords, sessions, create-user script

- **Action:** tests first (RED = "Failed to load url ./password"); added `src/lib/auth/{password,session}.ts`, `auth.test.ts`, `scripts/create-user.ts`; tsconfig `allowImportingTsExtensions` (noEmit only) so the script's `.ts` import typechecks.
- **Why:** scrypt N=2^17 needs maxmem 256 MiB (Node default 32 MiB rejects it); verify accepts only the fixed params so a tampered row cannot pick the cost; sessions store sha256(token) so a DB leak yields no usable tokens.
- **Result:** 48 tests pass, typecheck 0 errors. Script run with bad role / bad email / short password exits 1 before any DB connection. Insert path NOT exercised (no local Postgres).
- **Lesson:** a module imported by a plain-node script must stay free of `@/` aliases and server-only; keep the shared crypto in a pure file.

## [14:56] Task 5 — rate limiter + safe redirect

- **Action:** tests first (RED = "Cannot find module ./rateLimit"); added `rateLimit.ts` (fixed-window Map, sweep once per window) and `safeNext.ts`; instances loginByIp 20/15m, loginByEmail 5/15m, controlByUser 10/1m.
- **Why:** brute-force and command-flood limits; open-redirect guard for post-login `next`.
- **Result:** 63 tests pass, typecheck 0 errors. Dead end: my own test caught that the brief's origin check accepts `//x` (resolves to host `x` = the dummy origin), so I added an explicit `startsWith("//")` reject.
- **Lesson:** an origin check against a dummy host is bypassed by a protocol-relative URL naming that same dummy host; reject `//` lexically as well.

## [14:56] Task 6 — sign-in flow, proxy, DAL guards, protected API

- **Action:** tests first (RED = "Cannot find module './dal'" + 4 safeNext failures for `/\t/x`, `/\r\n/x`, `/\u0000/x`, normalized path). Added `src/lib/auth/dal.ts` (`getUser`, `requireUser`, `AuthError`, `authErrorResponse`), `src/app/login/{page,LoginForm,actions}.tsx|ts` (`signIn`, `signOut`), `src/proxy.ts`, `src/lib/auth/dal.test.ts`; fixed `safeNext`; guarded both water-level GET routes; sign-out button in `DashboardHeaderClient.tsx`. `layout.tsx` untouched (no provider needed).
- **Why:** proxy is an optimistic cookie-presence check only (Next 16 docs: Proxy is not an auth solution); `requireUser` is the real check. Limiters run before DB/scrypt; unknown email runs scrypt on a well-formed dummy hash so timing does not reveal accounts. Auth check sits inside the routes' existing try so a DB outage during the session lookup still returns 503.
- **Result:** 81 tests pass, typecheck 0 errors, eslint clean on touched files, `npm run build` OK (Proxy listed). Dev server: `/api/water-level` and `/download` → 401 JSON; `/dashboard` → 307 `/login?next=%2Fdashboard`; `/login` → 200. Successful login NOT exercised end to end (no local Postgres).
- **Lesson:** the WHATWG URL parser strips tab/CR/LF, so `"/\t/x"` parses as `//x` and passed the old origin check by naming the dummy host; reject control chars and return the parsed path, not the raw string.

## [15:20] Task 7 — FastAPI hardening

- **Action:** created `ai-receiver/.venv` (approved pkgs only); tests first in `ai-receiver/test_auth.py` (RED: 9 failed / 4 passed); then `main.py`: `API_HOST` env (default 127.0.0.1), CORS middleware + import removed, `verify_control_token` dependency (`X-Control-Token`, `hmac.compare_digest` on bytes, generic 401) on `/api/control` and `/api/update-count`, `require_control_secret()` (>=32 chars) called in lifespan and before `uvicorn.run`. `.env.example` gets `CONTROL_SHARED_SECRET`, `API_HOST`.
- **Why:** only the Next.js server calls FastAPI now; loopback + shared secret + no CORS closes unauthenticated pump control from LAN/browsers. Secret check lives in startup, not import, so `import main` works in tests.
- **Result:** 13 passed. Dead end: first startup test used `TestClient` context; anyio wraps `SystemExit` in an exception group, so the test enters `lifespan` directly instead.
- **Lesson:** a secret compare must be constant-time and on bytes (`compare_digest` on str raises for non-ASCII); a fail-fast check at import breaks tests, so put it on the startup path.

## [15:05] Task 8 — authenticated, rate-limited, audited control route

- **Action:** tests first: `src/app/api/control/route.test.ts` (14), `src/lib/control/forward.test.ts` (8), one new case in `dal.test.ts`. RED = 15 failed + "Cannot find module ./forward" (old route returned 502/500, `requireUser("superuser")` resolved for admin). Then: `src/lib/control/forward.ts` (`forwardCommand`, 5 s `AbortSignal.timeout`, `redirect: "error"`), full rewrite of `src/app/api/control/route.ts`, extracted `src/lib/http/clientIp.ts` (returns null, not "unknown"; `signIn` keeps "unknown" as its limiter key), `dal.ts` `RANK[minRole] ?? Infinity`, `.env.example` note that Next.js needs `CONTROL_SHARED_SECRET`.
- **Why:** order Origin -> requireUser("operator") -> JSON -> parseCommand -> controlByUser -> forward -> audit, so unauthenticated/cross-site requests touch nothing and junk commands do not burn the limit. Audit failure is logged, never returned, so a command that reached the pumps is not reported as failed (operator would resend).
- **Result:** 104 tests pass; typecheck 0; eslint clean on touched files; `npm run build` OK. Not exercised against a live FastAPI/Postgres.
- **Lesson:** `x < undefined` is always false in JS, so a rank lookup on an unknown key silently passes an authorization check; default the required side to `Infinity`. Also: `fetch` follows redirects with custom headers, so a secret-bearing call should use `redirect: "error"`.

## [15:20] Task 8 — review fix: non-IP forwarded headers

- **Action:** tests first: new `src/lib/http/clientIp.test.ts` (8 cases) and a route case (garbage XFF -> 200, audit ip null). RED = 6 failed. Then `clientIp` accepts a header value only if `net.isIP(trimmed) !== 0`, else falls through to `x-real-ip`, then null. `signIn` keeps `?? "unknown"` with a WHY line.
- **Why:** a non-IP `X-Forwarded-For` made the `inet` audit insert fail; `audit()` swallows that by design, so an operator could run a command with no audit row.
- **Result:** `npm test` 113/113; typecheck 0; eslint clean on touched files.
- **Lesson:** a "log and continue" error path turns any attacker-triggerable insert failure into an audit bypass; validate audit fields to the column type before insert.

## [15:35] Task 8 — review fix round 2: IPv6 zone ids, audit retry

- **Action:** tests first (RED = 5 failed): zone-id cases in `clientIp.test.ts`; route tests for zone-id XFF -> audit ip null, and first audit insert rejects -> retried once with ip null, still 200. Then `clientIp` rejects any value containing `%`; `audit()` retries once with `ip = null` when the first insert fails and ip was set.
- **Why:** `net.isIP("fe80::1%eth0") === 6` but Postgres `inet` rejects `%zone`, so round 1 still let a header drop the audit row. The retry covers any other ip value Postgres might reject.
- **Result:** `npm test` 118/118; typecheck 0; eslint clean on touched files; `npm run build` OK.
- **Lesson:** "valid" in one parser is not "valid" in the sink. Validate against what the column accepts, and keep a fallback in the path that must not lose data.

## [15:15] Task 9 — server-side MQTT subscriber + authenticated SSE stream

- **Action:** tests first: `src/lib/telemetry/stream.test.ts` (14 cases, fake `mqtt` client via `vi.mock`, fake DAL). RED = suite failed to load (`./broker` and route missing). Then `src/lib/telemetry/broker.ts` (`subscribeStatus`, one client per process on `globalThis.__wgTelemetry`, topics `stm32/status/all` + `MQTT_TOPIC_STATUS` when set and different, 64 KiB payload cap, 60 s rate-limited warn without payload echo, throwing listener isolated), `src/app/api/status/stream/route.ts` (`GET` SSE + `HEAD` auth probe, `requireUser()` before the stream, 503 generic on non-auth errors, 25 s ping, idempotent cleanup on abort/cancel, `dynamic = "force-dynamic"`), `src/hooks/useGateStatus.ts` (EventSource, HEAD probe on error -> 401 redirects to `/login?next=`, reopen after 5 s when EventSource is CLOSED), `.env.example` (`MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`; `NEXT_PUBLIC_*` marked `# DEPRECATED: removed in Task 10`).
- **Why:** the browser no longer needs broker credentials or a reachable broker port; telemetry is behind the same session check as every other API. `useMqtt.ts` and the old dashboard stay until Task 10 (controller ruling).
- **Result:** `npm test` 132/132; typecheck 0; eslint clean on touched files; `npm run build` OK (`ƒ /api/status/stream`). Not exercised against a live broker or in a browser.
- **Lesson:** EventSource never exposes the HTTP status and stops reconnecting for good on any non-200, so an auth-aware client needs a side probe (HEAD) and its own retry for the CLOSED state.

## [16:00] Task 10 — gate registry, staleness helper, camera proxy, SSE max lifetime

- **Action:** tests first: `src/lib/gates.test.ts`, `src/lib/telemetry/stale.test.ts`, `src/app/api/camera/webrtc/route.test.ts`, one fake-timer case in `stream.test.ts`. RED = 3 suites "Cannot find module" + lifetime case `expected 2 to be 1`. Then `src/lib/gates.ts` (`GATES`, `CAMERAS`, `getGate`), `src/lib/telemetry/stale.ts` (`isStale`, 30 s), extracted `sameOrigin` from the control route to `src/lib/http/sameOrigin.ts`, new `POST /api/camera/webrtc` (requireUser -> Origin -> src allowlist -> 64 KiB capped read -> go2rtc with 10 s timeout, `redirect: "error"`, non-2xx -> generic 502), 10-minute `setTimeout` in the SSE route that calls the existing idempotent cleanup.
- **Why:** Go2RTCPlayer called `http://192.168.1.151:1984` from an https page (mixed content + private IP), so cameras never worked on the live site; signalling now goes through an authenticated same-origin route. The SSE lifetime cap makes a revoked session stop streaming within 10 minutes.
- **Result:** `npm test` 151/151.
- **Lesson:** a ReadableStream keeps chunks queued after `close()`; a test that checks "stream ended" must drain the queue first (fake timers had queued 23 pings). Mini-ADR: body cap reads the stream incrementally instead of `req.text()`, because a chunked upload has no Content-Length to reject early.

## [16:25] Task 10 — page auth helper, dashboard split, role-gated controls

- **Action:** tests first: 2 `requirePageUser` cases in `dal.test.ts` (RED = 2 failed, export missing). Then `requirePageUser(next)` in `dal.ts` (unauthenticated -> `redirect("/login?next=…")` outside the try; other errors rethrow). Rewrote `src/app/dashboard/page.tsx` as a 21-line server component (await `searchParams`, default `gate-1`, `requirePageUser` before `getGate`, unknown -> `notFound()`); guarded `/` the same way. Moved the old 1177-line client page into `DashboardClient.tsx` + `_components/` (CameraGrid, ElectricCard, RadarCard, FloatSwitchCard, WireBreakCard, WaterLevelChart, DetectionCard, ControlPanel, Reading, LiveIcon) with the same Tailwind classes. Header takes `gateName`/`stale` props (badge ONLINE/OFFLINE). WaterGateMap uses `GATES` and links `/dashboard?gate=<id>`. Go2RTCPlayer posts to `/api/camera/webrtc`.
- **Why:** one telemetry source (`useGateStatus`), no browser MQTT/WebSocket/direct FastAPI, viewers get no control buttons (server enforces operator anyway), gates without hardware open no stream.
- **Result:** `npm test` 153/153; lint: only pre-existing `mqtt_bridge.js` require() errors; build OK.
- **Lesson:** device state is now telemetry-only, so values the payload never reports (light, relays) render "—" instead of the old optimistic ON/OFF. Mini-ADR: rejected keeping optimistic local state after a 200, because a 200 means "forwarded to FastAPI", not "relay switched".

## [16:35] Task 10 — cleanup and verification

- **Action:** `git rm` of `src/hooks/useMqtt.ts`, `src/app/dashboard/test.tsx`, `src/app/test/page.tsx` (approved by Leo); dropped the three DEPRECATED `NEXT_PUBLIC_*` lines from `.env.example`, added `GO2RTC_URL`. `grep -rn "NEXT_PUBLIC_" src` -> none. `npm run build`, then `grep -rlE "192\.168\.|:1984|:8000|:9001|mqtt\.esm|wss?://" .next/static` -> none. `next dev`: logged-out `/dashboard?gate=gate-1` -> 307 `/login?next=%2Fdashboard%3Fgate%3Dgate-1`, `/` -> 307, camera route -> 401; server stopped.
- **Why:** prove nothing in the shipped bundle points at a LAN host, broker or FastAPI.
- **Result:** all checks clean. Dead end: first `typecheck` failed on stale `.next/types` entries for the deleted `/test` page; `next build` and `next dev` regenerate them, after which `tsc` is clean.
- **Lesson:** Next writes route type validators into `.next/`; after deleting a route, run build/dev before trusting `tsc` errors.

## [16:50] Task 10 — fix round 1: hide stale device state in control panel

- **Action:** test first: `src/lib/telemetry/deviceBadge.test.ts` (4 cases). RED = "Cannot find module ./deviceBadge". Then pure `deviceBadge(value, stale)` in `src/lib/telemetry/deviceBadge.ts`; `ControlPanel` takes `stale`, shows "—" with muted badges and icons, and adds a "status unknown (offline)" hint beside each panel title when stale. Buttons stay enabled and the panel is not dimmed.
- **Why:** review I-1. Last-known pump/alarm ON/OFF stayed full colour next to live-looking buttons, so an operator could act on a 10-minute-old "ON".
- **Result:** `npm test` 157/157; typecheck 0; eslint on `src/app/dashboard` and `src/lib/telemetry` clean; build OK.
- **Lesson:** a stale value is most dangerous where it drives an action; there it should be hidden, not just dimmed.

## [17:10] Task 11 — security headers, lint override, README, branch security review

- **Action:** `next.config.ts` `headers()` on `/:path*` (HSTS, nosniff, X-Frame-Options DENY, Referrer-Policy, CSP). CSP additions found by reading components: `https://unpkg.com` in `img-src` (Leaflet marker PNGs in `WaterGateMap.tsx`); `'unsafe-eval'` only when `NODE_ENV !== production`. Go2RTCPlayer uses `iceServers: []`, no external origin; media is a MediaStream (blob covered). `eslint.config.mjs` override for root `*.js` (commonjs, node globals, no-require-imports off). README rewritten (architecture, env table, setup, deploy checklist, testing).
- **Why:** defence in depth against XSS/clickjacking/MIME sniffing. Rejected: nonce CSP now (needs dynamic rendering plumbing) -> `// TECH DEBT`.
- **Result:** `npm run build && npm run start`, `curl -sI localhost:3000/login` shows all five headers; /login scripts are `src=` chunks. lint exit 0, tests and typecheck run after.
- **Lesson:** a CSP is only as tight as the CDN hosts it lists; vendoring the marker icons would let us drop unpkg.

### Security checklist over `ff9c6af..HEAD` (applies / handled / open)

- Passwords: applies; scrypt N=2^17 + `timingSafeEqual` (`src/lib/auth`). Generic login error: handled. Brute force: per-IP + per-account limits in login route. Open: in-process limiter store (TECH DEBT, single instance OK).
- Input/query: applies; `pg` parameterized queries, command allowlist validated server-side, `safeNext` blocks open redirect. No path or shell input. Open: none.
- File upload: not applicable.
- Secrets: handled; no hardcoded values, `.env.example` placeholders, no `NEXT_PUBLIC_*`. Open: app DB user must be least-privilege (documented in README); real `.env` untouched.
- Supply chain: lockfile committed; no new runtime deps; `globals` used by eslint is a transitive dep (not declared). Open: dependency audit not run this task; versions not exact-pinned (carets).
- Crypto: handled; `randomBytes` for sessions, tokens stored hashed. No custom primitives.
- Errors/response: handled; generic client errors, `[module]` console.error. Open: none found.
- Rate limiting: handled on login; 429 + Retry-After. Open: camera/control routes rely on auth + Origin check, no dedicated limit.
- Session/token: handled; HttpOnly Secure SameSite=Lax cookie, 12 h expiry, SSE max lifetime 10 min. Not JWT.
- Transport/headers: handled by this task; HSTS, CSP, XFO, nosniff, Referrer-Policy. Open: `'unsafe-inline'` scripts (TECH DEBT); CORS: same-origin only, no CORS headers set.
- General: least privilege via roles, audit table for commands. Open: Phase 0 infra items are ops, not verified here.

## Summary

- Changed: next.config.ts, eslint.config.mjs, README.md, this log. Unchanged: mqtt_bridge.js, app logic.
- Mistakes & dead ends: none.
- 📌 GENERAL: check every third-party URL in source (icons, tiles) before writing a CSP.
