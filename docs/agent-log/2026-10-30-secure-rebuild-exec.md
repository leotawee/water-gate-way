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
