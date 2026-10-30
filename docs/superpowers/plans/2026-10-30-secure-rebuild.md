# Water Gate Way — Security-First Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the map.hyxc.io dashboard from this repo so that only signed-in users with the right role can read telemetry or actuate the pumps, and split the 1177-line dashboard into testable units.

**Architecture:** The browser never talks to the MQTT broker or FastAPI again. Next.js is the only public surface: it authenticates (opaque session cookie `wg_session`, Postgres-backed), streams telemetry to the browser over SSE from a server-side MQTT subscriber, and forwards validated commands to FastAPI on loopback with a shared secret. FastAPI and Mosquitto bind to `127.0.0.1` only.

**Tech Stack:** Next.js 16.2.2 (App Router, `proxy.ts`), React 19.2.4, TypeScript, `pg`, `mqtt` (server side only), Recharts, Leaflet, Vitest (new, dev only), FastAPI (ai-receiver), Mosquitto, nginx.

**Spec:** No written spec exists. The spec is the REA investigation of the live site (2026-10-30), summarized in "Findings" below. Raw evidence: REA capture `ev_246ed12ff5ebb90d742033ba2fc5d83ff0e9b1e8863254be466647b26b6e8282` and screenshot, kept outside the repo in the session scratchpad.

## Findings (the spec)

| # | Sev | Finding | Evidence |
|---|-----|---------|----------|
| F1 | 🔴 P0 | Browser MQTT client connects to `wss://map.hyxc.io/mqtt` with no credentials and publishes to `stm32/cmd`; nginx answers the WebSocket upgrade with `101` without a `wg_session` cookie. The command allowlist exists only in browser JS. | bundle `02pbcb91xcovj.js`; handshake probe |
| F2 | 🔴 P0 | FastAPI binds `0.0.0.0:8000`, CORS `allow_origins=["*"]`, `POST /api/control` and `POST /api/update-count` (which sends `M1`/`M0` to serial) have no auth. | `ai-receiver/main.py:55,394,424,441` |
| F3 | 🟠 P1 | `/api/water-level` returns 200 without a session; `/api/control` (Next) has no auth and no allowlist. | probe; `src/app/api/control/route.ts` |
| F4 | 🟠 P1 | TLS cert for `hyxc.io` expired 2026-08-17; name does not cover `map.hyxc.io`. | `openssl s_client` |
| F5 | 🟡 P2 | Login redirect check `startsWith("/") && !startsWith("//")` accepts `/\evil.com` (open redirect). | login chunk `11.9yxlj20gnl.js` |
| F6 | 🟡 P2 | Live site has open self-registration (`signUp` action) on a system that controls pumps. | server action names |
| B1 | bug | Header always shows "Unknown Gate"; `?location=` from the map is ignored. | `src/app/dashboard/page.tsx:483` |
| B2 | bug | A real `0` reading renders "—" (`liquid > 0 ? … : "—"`); missing and zero are indistinguishable. Radar `distance` is written into both `liquid` and `air`. | `page.tsx:299-300,592` |
| B3 | bug | Two telemetry formats parsed inline in three places in one component. | `page.tsx:280-400` |
| B4 | ops | Cameras office1–3 "Connection Failed"; `/ws/detections` returns 502. | screenshot; probe |

The live site's auth source code is not available (not in `origin` or `upstream`). Auth is rebuilt here from scratch.

## Global Constraints

- Next.js `16.2.2`: route interception file is `src/proxy.ts` exporting `proxy` (Middleware was renamed). Read `node_modules/next/dist/docs/01-app/02-guides/authentication.md` before Task 6.
- Package manager stays npm (`package-lock.json`). Node `>=22.6` (type-stripping for `scripts/*.ts`; dev machine has v26).
- DB driver stays `pg`. // TECH DEBT: default stack is postgres.js + Drizzle; switching now adds churn with no security gain.
- New dependencies allowed only as listed per task, and each install is a Hard Stop needing Leo's "yes": `vitest` (dev), `httpx` (Python, test only).
- Cookie: name `wg_session`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, max age 12 h.
- Roles, exact strings: `viewer` (read telemetry), `operator` (viewer + send commands), `admin` (operator + manage users).
- Command allowlist, exact: `P1 P0 A1 A0 L1 L0 M1 M0 R1 R0 Q1 Q0` — must stay identical to `VALID_COMMANDS` in `ai-receiver/main.py:60`.
- Password hashing: `node:crypto` `scrypt`, `N=2^17, r=8, p=1`, 16-byte salt, 64-byte key, stored as `scrypt$N$r$p$saltB64$hashB64`; compare with `timingSafeEqual`. (Mini-ADR: argon2id would need a native dependency; scrypt is on the approved list and is built in.)
- No `NEXT_PUBLIC_*` variable may hold a broker, FastAPI, or secret URL after Task 9.
- Errors to the client are generic; details go to `console.error` with a `[module]` prefix. Never log passwords, tokens, or cookie values.
- Every file edit appends an entry to `docs/agent-log/` (global CLAUDE.md rule).

## Review Focus

1. **Broker or FastAPI down** — UI shows "OFFLINE" and greys values; it never keeps showing the last numbers as live. Test: Task 9 `stream emits {type:"conn", state:"disconnected"}`.
2. **Reading is exactly 0** — renders `0.000`, not "—". Test: Task 2 `zero is a reading, not missing`.
3. **Session expires mid-use** — control call returns 401, no command is forwarded, client redirects to `/login`. Test: Task 8 `401 without session, forwardCommand not called`.
4. **Rapid repeat clicks** — more than 10 commands/min per user returns 429 with `Retry-After`; no silent drop. Test: Task 8 `11th command in a minute is 429`.
5. **Serial port closed** — FastAPI 503 surfaces as an error to the user and the audit row records `failed`. Test: Task 8 `FastAPI 503 → 502 to client, audit status failed`.

---

## Phase 0 — Containment on the live server (owner/ops, do first, no code)

Not code tasks; Leo hands this list to the owner. Each item closes a P0 today, before the rebuild ships.

- [ ] **Mosquitto:** `listener 1883 127.0.0.1`, `allow_anonymous false`, `password_file /etc/mosquitto/passwd`, `acl_file /etc/mosquitto/acl`. ACL: user `fastapi` may `readwrite stm32/#` and `water/#`; user `nextjs` may `read stm32/status/all` and `read water/gate/status`; ESP32/STM32 gateway users as needed. Remove any websocket listener.
- [ ] **nginx:** delete the `location /mqtt` and any `location /api/control` or `/ws/` block that proxies to Mosquitto or FastAPI directly. Only `proxy_pass` to Next.js remains.
- [ ] **FastAPI:** run with `host=127.0.0.1` (Task 10 makes it the default).
- [ ] **TLS:** `certbot --nginx -d map.hyxc.io` (or a `*.hyxc.io` DNS-01 cert); confirm `systemctl list-timers | grep certbot`.
- [ ] **Verify:** from outside, the WebSocket handshake to `https://map.hyxc.io/mqtt` no longer returns `101`, and `nc -vz map.hyxc.io 1883` and `:8000` fail.
- [ ] **Rotate** the admin password that was pasted into chat on 2026-10-30.

---

### Task 1: Test harness

**Files:**
- Create: `vitest.config.ts`, `src/lib/__tests__/smoke.test.ts`
- Modify: `package.json` (scripts `test`, `typecheck`)

**Interfaces:** Produces: `npm test` (vitest run), `npm run typecheck` (`tsc --noEmit`). Path alias `@/` → `src/`.

- [ ] **Step 1:** ⚠️ Hard Stop — ask Leo, then `npm install -D vitest@<latest 3.x, exact>`.
- [ ] **Step 2:** `vitest.config.ts` with `environment: "node"`, `resolve.alias { "@": "./src" }`, `include: ["src/**/*.test.ts"]`.
- [ ] **Step 3:** smoke test `expect(1 + 1).toBe(2)`; run `npm test` → 1 passed. Run `npm run typecheck` → record the current error count as baseline (do not fix unrelated errors here).
- [ ] **Step 4:** Commit `chore: add vitest harness`.

### Task 2: Command allowlist and telemetry parser (pure modules)

**Files:**
- Create: `src/lib/control/commands.ts`, `src/lib/control/commands.test.ts`
- Create: `src/lib/telemetry/parseStatus.ts`, `src/lib/telemetry/parseStatus.test.ts`, `src/lib/telemetry/fixtures.ts`

**Interfaces:**
- Produces: `type Command = "P1"|"P0"|"A1"|"A0"|"L1"|"L0"|"M1"|"M0"|"R1"|"R0"|"Q1"|"Q0"`; `parseCommand(raw: unknown): Command | null` (trims, upper-cases, exact-set check; non-string → null).
- Produces: `type GateStatus = { pzem: { voltage: number|null; current: number|null; frequency: number|null; power: number|null }; radar: { liquid: number|null; airGap: number|null }; float: Record<string, boolean>; wireBreak: { red: boolean|null; blue: boolean|null }; devices: { pump: boolean|null; alarm: boolean|null; light: boolean|null; relay1: boolean|null; relay2: boolean|null }; personCount: number|null; receivedAt: string }` and `parseStatus(payload: unknown, now: Date): GateStatus | null`.

- [ ] **Step 1:** Copy one real payload of each format into `fixtures.ts`: Format A `{ stm32: { PZEM, Radar, WireBreak, … } }` (as built by `build_unified_payload` in `ai-receiver/main.py`) and Format B `{ pzem, radar, float, wirebreak, pump, alarm }` (`stm32/status/all`). Take field names from the current branches in `src/app/dashboard/page.tsx:280-400`; if a real sample is obtainable from the broker, prefer it.
- [ ] **Step 2: Failing tests**
  - `parseCommand`: `"p1 "` → `"P1"`; `"P2"`, `"P"`, `"P10"`, `""`, `42`, `null` → `null`; every one of the 12 commands round-trips.
  - `parseStatus`: Format A fixture → expected `GateStatus`; Format B fixture → expected `GateStatus`; `"zero is a reading, not missing"`: `radar.liquid = 0` → `0` (not `null`); missing field → `null`; `"distance is not liquid"`: Format A with only `Radar.distance` → `airGap` set, `liquid` null; non-object / invalid JSON value → `null`; `NaN`/string `"abc"` numbers → `null`.
- [ ] **Step 3:** Run `npm test -- src/lib` → FAIL (modules missing).
- [ ] **Step 4:** Implement both modules. `parseStatus` uses one `num(v: unknown): number|null` helper (`Number.isFinite` check) — no `?? 0` anywhere.
- [ ] **Step 5:** `npm test` → PASS. Commit `feat: shared command allowlist and telemetry parser`.

### Task 3: Database: shared pool and auth schema

**Files:**
- Create: `src/lib/db.ts`, `db/migrations/001_auth.sql`
- Modify: `src/app/api/water-level/route.ts`, `src/app/api/water-level/download/route.ts` (import shared pool, delete local `new Pool`)

**Interfaces:**
- Produces: `export const db: Pool` (single instance, `globalThis` cache in dev to survive HMR); `server-only` import guard.
- Schema (exact):
  - `users(id uuid pk default gen_random_uuid(), email citext unique not null, password_hash text not null, role text not null check (role in ('viewer','operator','admin')), disabled boolean not null default false, created_at timestamptz not null default now())`
  - `sessions(id uuid pk default gen_random_uuid(), user_id uuid not null references users(id) on delete cascade, token_hash bytea unique not null, expires_at timestamptz not null, created_at timestamptz not null default now())` + index on `expires_at`
  - `control_audit(id bigserial pk, user_id uuid references users(id), command text not null, status text not null check (status in ('sent','rejected','failed','rate_limited')), ip inet, created_at timestamptz not null default now())`
  - `create extension if not exists citext; create extension if not exists pgcrypto;`

- [ ] **Step 1:** Write the migration file (idempotent `if not exists`). Do not run it.
- [ ] **Step 2:** ⚠️ Hard Stop (DB migration) — Leo runs or approves `psql "$DATABASE_URL" -f db/migrations/001_auth.sql` against a dev DB first. The app DB user needs `SELECT/INSERT/UPDATE/DELETE` on these tables only, not superuser.
- [ ] **Step 3:** Refactor both water-level routes to `import { db } from "@/lib/db"`. `npm run build` succeeds; `GET /api/water-level` on dev returns the same JSON as before.
- [ ] **Step 4:** Commit `refactor: shared pg pool; feat: auth schema migration`.

### Task 4: Passwords and sessions

**Files:**
- Create: `src/lib/auth/password.ts`, `src/lib/auth/session.ts`, `src/lib/auth/auth.test.ts`
- Create: `scripts/create-user.ts`

**Interfaces:**
- Produces: `hashPassword(plain: string): Promise<string>`; `verifyPassword(plain: string, stored: string): Promise<boolean>` (false on malformed `stored`, never throws).
- Produces: `type SessionUser = { id: string; email: string; role: "viewer"|"operator"|"admin" }`; `createSession(userId: string): Promise<{ token: string; expiresAt: Date }>` (32 bytes `randomBytes`, base64url; stores `sha256(token)`); `getSessionUser(token: string | undefined): Promise<SessionUser | null>` (null if missing, expired, or user disabled); `revokeSession(token: string): Promise<void>`; `SESSION_COOKIE = "wg_session"`; `sessionCookieOptions(expiresAt: Date)`.
- `scripts/create-user.ts`: `node scripts/create-user.ts <email> <role>`; reads password from stdin with echo off; inserts user. This is how users are created (see F6).

- [ ] **Step 1: Failing tests** (`db` mocked with an in-memory fake for session tests)
  - hash then verify → true; wrong password → false; two hashes of the same password differ; stored string starts with `scrypt$131072$8$1$`; malformed stored → false.
  - createSession stores a hash ≠ token; getSessionUser(token) → user; expired → null; disabled user → null; after revokeSession → null; `undefined` → null.
- [ ] **Step 2:** `npm test` → FAIL. **Step 3:** implement per Global Constraints. **Step 4:** PASS.
- [ ] **Step 5:** Create one admin on dev with the script; confirm row in `users`. Commit `feat: password hashing and DB sessions`.

### Task 5: Login rate limit and safe redirect

**Files:**
- Create: `src/lib/auth/rateLimit.ts`, `src/lib/auth/safeNext.ts`, `src/lib/auth/guards.test.ts`

**Interfaces:**
- Produces: `createRateLimiter(opts: { limit: number; windowMs: number }): { hit(key: string, now?: number): { ok: true } | { ok: false; retryAfterSec: number } }` — fixed-window `Map`. `// TECH DEBT: in-process store; move to Redis if >1 instance.`
- Instances (exact): `loginByIp` 20/15 min, `loginByEmail` 5/15 min, `controlByUser` 10/1 min.
- Produces: `safeNext(next: string | null | undefined, fallback = "/dashboard"): string` — accept only if `new URL(next, "http://x").origin === "http://x"` and `next` starts with `/`, contains no `\`.

- [ ] **Step 1: Failing tests:** limiter allows `limit` hits, the next returns `ok:false` with `retryAfterSec > 0`, resets after window; `"11th command in a minute is 429"` at the limiter level. `safeNext`: `/dashboard?gate=gate-1` kept; `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:alert(1)`, `""`, `null` → fallback.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: rate limiter and safe redirect`.

### Task 6: Sign-in flow and route protection

**Files:**
- Create: `src/app/login/page.tsx`, `src/app/login/LoginForm.tsx`, `src/app/login/actions.ts`, `src/lib/auth/dal.ts`, `src/proxy.ts`, `src/lib/auth/dal.test.ts`
- Modify: `src/app/layout.tsx` (no auth provider needed; server reads session), `src/components/DashboardHeaderClient.tsx` (sign-out button)

**Interfaces:**
- Consumes: Task 4, Task 5.
- Produces: `signIn(prev: SignInState, form: FormData): Promise<SignInState>` where `SignInState = { error?: "invalid" | "rate_limited" } | undefined`; `signOut(): Promise<void>`.
- Produces (`dal.ts`, `server-only`, wrapped in React `cache`): `getUser(): Promise<SessionUser | null>`; `requireUser(minRole: "viewer"|"operator"|"admin" = "viewer"): Promise<SessionUser>` — throws `AuthError("unauthenticated")` / `AuthError("forbidden")`; `authErrorResponse(e: unknown): NextResponse | null` maps to 401/403 JSON `{ error: "unauthorized" }` / `{ error: "forbidden" }`.
- `proxy.ts`: optimistic check only — if no `wg_session` cookie and path is not `/login` or `/_next/*` or `/favicon.ico`, redirect to `/login?next=<path>`; for `/api/*` return 401 JSON instead of redirect. Real checks stay in `requireUser`.

- [ ] **Step 1: Failing tests** for `requireUser`: no session → `unauthenticated`; `viewer` asking for `operator` → `forbidden`; `admin` passes `operator`. For `signIn` (db and limiter faked): wrong password and unknown email both return `{ error: "invalid" }` (same message, F-rule: no user enumeration); 6th attempt for one email in 15 min → `rate_limited`; success sets cookie `wg_session` with the Global Constraints attributes and redirects to `safeNext(next)`.
- [ ] **Step 2:** FAIL. **Step 3:** implement; no sign-up page or action (F6 decision — see Open Questions). **Step 4:** PASS.
- [ ] **Step 5:** Add `await requireUser()` at the top of `GET /api/water-level` and `/api/water-level/download`, wrapped with `authErrorResponse`. Manual check on `npm run dev`: logged out, `curl -i localhost:3000/api/water-level` → 401; `/dashboard` → 307 to `/login?next=%2Fdashboard`; login → lands on dashboard.
- [ ] **Step 6:** Commit `feat: session sign-in, proxy redirect, protected API`.

### Task 7: FastAPI hardening (ai-receiver)

**Files:**
- Modify: `ai-receiver/main.py:55-56` (host from `API_HOST` env, default `127.0.0.1`), `:391-397` (CORS: remove middleware entirely — only Next calls it now), `:424`, `:441` (token dependency)
- Create: `ai-receiver/test_auth.py`
- Modify: `.env.example` (add `CONTROL_SHARED_SECRET=change_me_32_bytes_min`, both services)

**Interfaces:**
- Produces: header `X-Control-Token: <CONTROL_SHARED_SECRET>` required on `POST /api/control` and `POST /api/update-count`; compared with `hmac.compare_digest`; missing/short (<32 chars) env secret → process refuses to start.
- `/ws/detections` stays but is reachable only on loopback.

- [ ] **Step 1:** ⚠️ Hard Stop — ask before `pip install httpx` (needed by `fastapi.testclient`).
- [ ] **Step 2: Failing tests:** no header → 401; wrong token → 401; right token + `"P1"` with serial mocked → 200; right token + `"ZZ"` → rejected; same for `/api/update-count`.
- [ ] **Step 3:** `pytest ai-receiver/test_auth.py` → FAIL. **Step 4:** implement. **Step 5:** PASS. Commit `fix(ai-receiver): loopback bind, shared-secret auth, drop wildcard CORS`.

### Task 8: Authenticated control route

**Files:**
- Modify: `src/app/api/control/route.ts` (full rewrite)
- Create: `src/lib/control/forward.ts`, `src/app/api/control/route.test.ts`

**Interfaces:**
- Consumes: `parseCommand` (T2), `requireUser("operator")` (T6), `controlByUser` (T5), `db` (T3).
- Produces: `forwardCommand(cmd: Command): Promise<"sent" | "failed">` — `POST ${FASTAPI_URL}/api/control` with `X-Control-Token`, 5 s `AbortSignal.timeout`.
- Route contract: body `{ command: string }` → 200 `{ ok: true, command }` | 400 `{ error: "invalid_command" }` | 401 | 403 | 429 `{ error: "rate_limited" }` + `Retry-After` | 502 `{ error: "device_unavailable" }`. Every outcome after auth writes one `control_audit` row (`sent|rejected|failed|rate_limited`). Rejects requests whose `Origin` header ≠ the app origin (CSRF) with 403.

- [ ] **Step 1: Failing tests** (forward, db, user faked): `"401 without session, forwardCommand not called"`; viewer → 403; `"ZZ"` → 400 + audit `rejected`; valid → 200 + audit `sent`; `"11th command in a minute is 429"` with `Retry-After`; `"FastAPI 503 → 502 to client, audit status failed"`; foreign `Origin` → 403.
- [ ] **Step 2–4:** FAIL → implement → PASS. Commit `feat: authenticated, audited control endpoint`.

### Task 9: Server-side telemetry stream (replaces browser MQTT)

**Files:**
- Create: `src/lib/telemetry/broker.ts`, `src/app/api/status/stream/route.ts`, `src/lib/telemetry/stream.test.ts`, `src/hooks/useGateStatus.ts`
- Delete (Hard Stop, confirm): `src/hooks/useMqtt.ts`
- Modify: `.env.example` (remove `NEXT_PUBLIC_MQTT_URL`, `NEXT_PUBLIC_WS_URL`, `NEXT_PUBLIC_API_URL`; add `MQTT_URL=mqtt://127.0.0.1:1883`, `MQTT_USERNAME=nextjs`, `MQTT_PASSWORD=change_me`)

**Interfaces:**
- Produces (`broker.ts`, `server-only`): `subscribeStatus(listener: (e: StatusEvent) => void): () => void`, where `type StatusEvent = { type: "status"; status: GateStatus } | { type: "conn"; state: "connected" | "disconnected" }`. One lazily created `mqtt` client per process (`globalThis` cache) subscribed to `stm32/status/all` and `process.env.MQTT_TOPIC_STATUS`; messages go through `parseStatus`; new listeners immediately receive the last `conn` state and last status.
- Produces route `GET /api/status/stream`: `requireUser()`, then `text/event-stream`, one `data: <StatusEvent JSON>\n\n` per event, `: ping` every 25 s, unsubscribes on `request.signal` abort. Node runtime (default).
- Produces hook: `useGateStatus(): { status: GateStatus | null; conn: "connecting" | "connected" | "disconnected" }` using `EventSource("/api/status/stream")`; on error sets `disconnected`; if the stream returns 401, `window.location.assign("/login?next=" + path)`.

- [ ] **Step 1: Failing tests** (fake `mqtt` client via `vi.mock`): `"stream emits {type:"conn", state:"disconnected"}"` when the client emits `offline`; valid payload → one `status` event; invalid payload → no event; unsubscribe removes the listener; route without session → 401.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5:** `grep -rn "NEXT_PUBLIC_" src` → no matches. `npm run build`, then grep `.next/static` for `mqtt` and `8000` → no matches. Commit `feat: authenticated SSE telemetry, remove browser MQTT`.

### Task 10: Gate registry and dashboard split

**Files:**
- Create: `src/lib/gates.ts`
- Modify: `src/components/WaterGateMap.tsx` (use `GATES` from `gates.ts`, link to `/dashboard?gate=<id>`)
- Rewrite: `src/app/dashboard/page.tsx` (server component, ≤60 lines)
- Create: `src/app/dashboard/DashboardClient.tsx` and `src/app/dashboard/_components/{CameraGrid,ElectricCard,RadarCard,FloatSwitchCard,WireBreakCard,WaterLevelChart,DetectionCard,ControlPanel,Reading}.tsx`
- Delete (Hard Stop, confirm): `src/app/dashboard/test.tsx`, `src/app/test/page.tsx`

**Interfaces:**
- Produces: `type Gate = { id: string; name: string; lat: number; lng: number; hasDevice: boolean }`; `GATES: Gate[]` (5 existing entries; ids `gate-1` … `gate-5`; only `gate-1` has `hasDevice: true` — see Open Questions); `getGate(id: string | undefined): Gate | null`.
- `page.tsx`: `const user = await requireUser()`; reads `searchParams.gate` (await it — Next 16 async `searchParams`); unknown id → `notFound()`; renders `<DashboardClient gate={gate} role={user.role} />`.
- `Reading` component: `({ value, digits, unit }: { value: number | null; digits: number; unit: string })` — `null` → "—", otherwise `value.toFixed(digits)` (fixes B2).
- `ControlPanel`: rendered only when `role !== "viewer"`; one `sendCommand(cmd: Command)` that POSTs `/api/control`, disables the button while in flight, shows the error text for 429/502/403.
- Header shows `gate.name` (fixes B1). Gates with `hasDevice: false` show "No device installed" instead of live cards.
- Visual design and layout stay as on the live site (yellow header, card grid, Thai control labels as captured: `เปิดปั๊มปกติ`, `ปิดปั๊มปกติ`, `เปิด Alarm`, `ปิด Alarm`, `เปิดไฟ`, `ปิดไฟ`, `เปิด`, `ปิด`).

- [ ] **Step 1: Failing tests:** `getGate("gate-1")` → Gate 1; `getGate("nope")`/`undefined` → null. (UI cards are covered by the Task 2 parser tests plus the manual check below; no component-test dependency added.)
- [ ] **Step 2:** Move each card's JSX out of the old page into its component unchanged, swapping state reads for `GateStatus` fields. Delete the inline parsers; the only telemetry source is `useGateStatus()`.
- [ ] **Step 3:** `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` → all exit 0.
- [ ] **Step 4:** Manual check with the browser pane against `npm run dev` + a local Mosquitto publishing the Task 2 fixtures: header shows the gate name; a `0` level shows `0.000`; stopping Mosquitto flips the badge to OFFLINE within 5 s; a viewer account sees no control buttons; an operator click on `เปิดไฟ` creates a `control_audit` row.
- [ ] **Step 5:** Commit `refactor: split dashboard into cards, gate registry, role-gated controls`.

### Task 11: Security headers and docs

**Files:**
- Modify: `next.config.ts` (`headers()`), `README.md` (env, user creation, Phase 0 deploy checklist)

**Interfaces:** Headers on `/:path*`: `Strict-Transport-Security: max-age=63072000; includeSubDomains`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: default-src 'self'; img-src 'self' data: https://*.tile.openstreetmap.org; connect-src 'self'; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; frame-ancestors 'none'`. // TECH DEBT: `'unsafe-inline'` for scripts until nonce-based CSP is wired.

- [ ] **Step 1:** Add headers; `curl -sI localhost:3000/login` shows all five.
- [ ] **Step 2:** Verify map tiles and Go2RTC player still load with CSP on (camera `connect-src`/`media-src` may need the go2rtc origin; if go2rtc is served through the same nginx origin, `'self'` suffices).
- [ ] **Step 3:** Run the security checklist from global CLAUDE.md over the diff; record results in the agent log. Commit `feat: security headers; docs: deploy checklist`.

---

## Open Questions (Leo/owner decide before the named task)

1. **Self-registration (before Task 6):** plan removes public sign-up; users are created with `scripts/create-user.ts`. If the owner wants sign-up, new accounts must default to `viewer` and need admin approval.
2. **Gates 2–5 (before Task 10):** the map shows 5 gates but only one STM32 publishes. Plan marks gates 2–5 "No device installed". Confirm, or supply a device-id ↔ gate mapping.
3. **Cameras and detections (B4):** office1–3 and `/ws/detections` fail on the server. That is go2rtc / ai-receiver process health on the host, not app code; owner checks `systemctl status` for both. Not in this plan's code tasks.
4. **Deployed source:** if the owner's private source turns up, diff it against this plan before Task 6 so the rebuild keeps any user data or flows we can't see from outside.
