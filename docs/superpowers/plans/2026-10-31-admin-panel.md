# Admin panel, legacy logins and gates from the database

> Status: spec, not implemented. Owner decisions (2026-10-31): admin panel manages users AND map gates; the 7 old accounts keep their old passwords (bcrypt, rehashed to scrypt on first login); import the old data from `public.users` and `public.devices`.
> Implementer: follow TDD (test first, see it fail, then code). Run `npm test`, `npm run typecheck` (ignore only `scripts/dev/db-inspect.ts`) and `npx eslint src` before reporting.
> Next.js 16: read `node_modules/next/dist/docs/` for Server Actions, `redirect`, `revalidatePath` before using them. Follow the patterns already in `src/app/login/actions.ts` and `src/lib/auth/dal.ts`.

## Ground rules (security, do not relax)

- Every admin page and action calls `requireUser("admin")` itself (proxy.ts only checks the cookie). Pages use a redirect for unauthenticated users like `requirePageUser`; a logged-in non-admin gets `notFound()` (do not reveal the page exists).
- Server Actions validate all input on the server (type, length, format). Never trust hidden fields for the acting user; take it from `requireUser`.
- SQL: parameterized queries only (`db.query(sql, params)`), no string interpolation.
- Responses and props contain whitelisted fields only. Never send `password_hash` to the client.
- An admin cannot disable, demote or delete their own account (prevents locking everyone out).
- Disabling a user or resetting a password deletes that user's rows in `sessions` (forces logout).
- Every admin change writes one row to a new table `wgw.admin_audit` (actor id, action, target, ip via `clientIp`, time). No passwords in it.
- No new dependency except `bcryptjs` (pin the exact version `3.0.3`, the version the old app used).

## Part A: legacy bcrypt passwords

1. `src/lib/auth/password.ts`
   - `verifyPassword(plain, stored)`: keep the scrypt path unchanged. Add: if `stored` matches `/^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/` and cost is between 4 and 12 inclusive, return `bcrypt.compare(plain, stored)`; any other `$2` cost returns false (a tampered row must not choose a huge cost: DoS). Wrap in the existing try/catch so errors return false.
   - Add `export function needsRehash(stored: string): boolean` = true when `stored` does not start with `scrypt$`.
   - Keep the header comment true: `bcryptjs` is pure JS, so `scripts/create-user.ts` still runs under plain `node`.
2. `src/app/login/actions.ts` `signIn`: after a successful login (`ok` and not disabled), if `needsRehash(u.password_hash)`, run `update users set password_hash = $1 where id = $2` with `await hashPassword(password)`. A failure there is logged (`console.error("[auth/signIn] rehash failed")`, no password, no hash) and does NOT block the login.
3. Tests (`src/lib/auth/auth.test.ts` or a new `password.test.ts`): bcrypt hash of "correct horse" verifies; wrong password fails; `$2b$31$...` (cost 31) returns false without hashing; malformed `$2b$` string returns false; `needsRehash` true for bcrypt, false for scrypt. Generate the bcrypt fixture with cost 4 in the test (`bcrypt.hashSync(pw, 4)`) so tests stay fast.
   Login action: existing tests mock `db`; add one case asserting the rehash `update` is issued for a bcrypt row and not for a scrypt row.

## Part B: migration `db/migrations/002_admin.sql`

Runs with `psql -1` and `PGOPTIONS='-c search_path=wgw,public'` (same as 001). Must be idempotent (`if not exists`, `on conflict do nothing`). It must NOT modify or drop anything in `public`.

```sql
create table if not exists gates (
  id          text primary key check (id ~ '^gate-[0-9]{1,4}$'),
  name        text not null check (length(name) between 1 and 100),
  location    text not null default '' check (length(location) <= 200),
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  has_device  boolean not null default false,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

create table if not exists admin_audit (
  id          bigserial primary key,
  actor_id    uuid references users(id),
  action      text not null,
  target      text not null,
  ip          inet,
  created_at  timestamptz not null default now()
);

-- Old gates: public.devices.device_id 'GATE-001' becomes 'gate-1' (the id the URLs already use).
insert into gates (id, name, location, lat, lng, has_device, active)
select 'gate-' || ltrim(substring(d.device_id from '[0-9]+$'), '0'),
       d.name, coalesce(d.location_name, ''), d.lat, d.lng,
       d.device_id = 'GATE-001',   -- only gate 1 has an STM32 and cameras today
       coalesce(d.is_active, true)
from public.devices d
where d.device_id ~ '^GATE-[0-9]+$'
on conflict (id) do nothing;

-- Old accounts keep their bcrypt hash; it is replaced by scrypt on first login.
-- Old role 'admin' stays admin; anything else becomes 'viewer' (least privilege; an admin can promote).
insert into users (email, password_hash, role, created_at)
select lower(trim(u.email)), u.password_hash,
       case when u.role = 'admin' then 'admin' else 'viewer' end,
       coalesce(u.created_at, now())
from public.users u
where u.email is not null and u.password_hash like '$2%'
on conflict (email) do nothing;
```

Add a vitest test that reads the SQL file and asserts it never contains `drop`, `delete`, `truncate`, `alter table public` or `update public` (cheap guard against a destructive edit).

## Part C: gates from the database

- `src/lib/gates.ts`: keep `type Gate` and `CAMERAS` as they are. Replace the `GATES` constant and `getGate` with server-only functions in a new `src/lib/gatesDb.ts` (`import "server-only"`): `listGates({ includeInactive })` and `getGate(id)` (validate `id` against `/^gate-[0-9]{1,4}$/` before querying; return null otherwise). Map `has_device` to `hasDevice`. Active only by default.
- `src/app/page.tsx`: fetch `listGates()` and pass to `WaterGateMapLoader` → `WaterGateMap` as a `gates` prop (plain serializable objects).
- `src/app/dashboard/page.tsx`: `await getGate(id)`; inactive or missing → `notFound()`.
- Update tests that imported `GATES`/`getGate` from `@/lib/gates`.

## Part D: admin UI (`src/app/admin/`)

Plain server components + Server Actions + Tailwind, styled like the existing pages. No client state library.

- `/admin` (layout or page): admin-only guard as above; links to Users and Gates; link back to the map. Add an "Admin" link in the map page header and `DashboardHeaderClient` only when `role === "admin"`.
- `/admin/users`: table of email, role, disabled, created_at. Actions per row: change role (viewer/operator/admin), disable/enable, reset password (admin types the new one; min 8, max 1024 chars, same rule as `scripts/create-user.ts`). Form to create a user (email validated like `create-user.ts`, role, password). Duplicate email → friendly error, not a 500.
- `/admin/gates`: table of id, name, location, lat, lng, has_device, active. Create (id must match `^gate-[0-9]{1,4}$`), edit, activate/deactivate. No hard delete (deactivate instead).
- Actions live in `src/app/admin/actions.ts` (`"use server"`), each: `requireUser("admin")` → validate → query → `admin_audit` insert → `revalidatePath`. Return `{ error }` objects for validation errors like `SignInState`.
- Tests: for every action, (1) unauthenticated → rejected, (2) viewer/operator → rejected, (3) invalid input → error and no query, (4) self-demote/self-disable → rejected, (5) happy path issues the expected parameterized query and an audit insert. Mock `db` and `requireUser` the way existing tests do.

## Out of scope

Deleting users or gates, editing old `public.*` tables, MQTT, cameras, any change to `next.config.ts` CSP.

## Deploy (owner approves before each step)

1. Backup (done in P1: `~/wgw/backups/`).
2. Run `002_admin.sql` against `watergate_db` with `psql -1` inside the container.
3. Build and ship a new release like `20261031-566e079`; `npm ci --omit=dev` is NOT needed if only `bcryptjs` was added: copy `node_modules` with `cp -al`, then `rsync` the `bcryptjs` package folder in. Restart `water-gate`.
4. Verify: an old account logs in with its old password and its hash now starts with `scrypt$`; `/admin` is 404 for a viewer; the map shows the 5 gates from the DB.
