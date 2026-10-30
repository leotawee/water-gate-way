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
