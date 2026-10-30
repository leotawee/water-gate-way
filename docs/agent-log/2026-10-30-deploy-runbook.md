# 2026-10-30 — Deploy runbook for the rebuilt app

## [19:30] Why the cameras still failed (Leo's screenshot)

- **Action:** read-only checks on the droplet: build age, nginx routes, reachability of the Pi's go2rtc ports.
- **Result:** the page was the old build (badge "WEBRTC P2P"; `BUILD_ID` 2026-07-30). The old player calls the droplet itself, nginx has no route to go2rtc or the Pi, and the droplet cannot reach the Pi's 1984/8555.
- **Lesson:** 📌 GENERAL: after writing a fix, check which build the user is actually looking at before debugging further.

## [19:45] Facts gathered for the runbook (read-only)

- **Action:** Node/npm/swap/disk, `.env.local` variable names only, deployed `package.json`, full nginx `default`, systemd unit.
- **Result:** Node 20.20.2 (Next 16 runs; `create-user.ts` must run from the Mac); the old app has `bcryptjs` and `jose`, so the production DB likely has its own `users` table (collision risk with our migration, and old accounts cannot sign in on the new build); nginx has a static `/dashboard/` alias and no `X-Forwarded-*` headers; the unit file has stray pasted heredoc lines; 6 packages in our `package.json` are imported nowhere.
- **Dead end avoided:** I did not read the production DB schema myself (docker exec is root-equivalent access to live data); the check is a read-only query in the runbook for Leo to approve or run.
- **Lesson:** 📌 GENERAL: before a migration, check for name collisions with the schema that already exists; `create table if not exists` hides them.

## [19:55] Runbook written

- **Action:** created `docs/superpowers/plans/2026-10-30-deploy-droplet.md`; pointed the D4 line of the broker-lockdown plan at it.
- **Decisions (mini-ADR):** release directories plus a `current` symlink (rollback is one symlink, the old directory stays untouched); the migration runs with `psql -1` (single transaction); the first admin is created from the Mac through an SSH tunnel (Node 20 on the droplet cannot run the `.ts` script, and the DB password never lands on the droplet's shell); deploy before the broker lockdown because the new app can connect anonymously.
- **Blockers found:** G1, with no FastAPI on the droplet the new `/api/control` would fail, so the web would lose pump control; G2, possible `users` table collision.

## [20:20] Production database check (approved by Leo, read-only, names only)

- **Action:** `docker exec watergate-postgres psql` for metadata only: database and role names, extensions, table and column names, `to_regclass` collision test. No rows read. Also read the 4 non-secret `PG*` values of the live `.env.local`.
- **Why:** the old app has its own login (bcryptjs, jose), so a `users` table was likely; our migration uses `create table if not exists`.
- **Result:** `public.users` exists (id uuid, email varchar, name, role varchar, password_hash text, created_at; no `disabled`). `sessions` and `control_audit` do not exist. One role, `water_admin`, a superuser, is what the app uses. Only `plpgsql` is installed. Tables: `device_command_logs`, `devices`, `users`, `water_levels`.
- **Decision (mini-ADR):** keep our tables in a separate schema `wgw` and set `PGOPTIONS="-c search_path=wgw,public"` (verified: `node_modules/pg/lib/connection-parameters.js:83` reads it). Rejected: `alter table users add column disabled` (changes the live table, breaks rollback, still needs bcrypt support for old hashes) and renaming our tables (code and test changes).
- **New finding:** the app connects as a superuser, and port 5432 is published to the internet. Added a hardening step (limited role `wgw_app`) and marked the Postgres port as the first item of the perimeter phase.
- **Mistake:** my first runbook update script failed before writing because `re.sub` treated `\password` in the replacement text as an escape; nothing was changed by that run. Re-ran with function replacements.
- **Lesson:** 📌 GENERAL: pass replacement text to `re.sub` as a function when it can contain backslashes.

## [21:10] G1 resolved: operator commands now go over authenticated MQTT (approved by Leo)

- **Action:** TDD. New `src/lib/telemetry/publish.test.ts` (7 tests) and a rewritten `src/lib/control/forward.test.ts` (14), RED first (`publish is not a function`). Then `publish()` in `src/lib/telemetry/broker.ts`, `forwardCommand` rewritten to call it (same signature, so `/api/control` and its 17 tests are unchanged), `COMMANDS` exported from `commands.ts` so tests use the single source list, `queueQoSZero: false` on the client. README, `.env.example`, runbook and lockdown plan updated; stale README lines about WebRTC and binding Mosquitto to loopback fixed on the way.
- **Why:** the droplet has no FastAPI, so the old forward path would give 502 on every web command. The Pi's `cmd_node` already reads `stm32/cmd`.
- **Result:** 185/185 tests, typecheck 0 errors, lint clean, build OK.
- **Decisions (mini-ADR):**
  - QoS 0 with `queueQoSZero: false` instead of QoS 1: mqtt.js would queue or resend, so a pump command could arrive late, after the user already saw a failure or sent the opposite command. At most once is the safer failure mode for actuators. The cost is that `sent` means "written to the broker connection", not "the Pi received it".
  - One shared MQTT connection (the subscriber's) instead of a second client: no extra credentials or reconnect logic.
  - Rejected: A) FastAPI on the Pi plus a tailnet rule (more moving parts, needs the tailnet admin).
- **Not verified:** a real command against the real broker and Pi; Mosquitto ACL behaviour on a denied write (MQTT 3.1.1 gives no error for it); that the `nextjs` account can write `stm32/cmd` after the lockdown.
- **Lesson:** 📌 GENERAL: for actuators prefer at-most-once delivery and refuse to queue while offline; a late command is worse than a failed one.

## Summary

- Changed: the runbook, one pointer line and the urgent Postgres note in the lockdown plan, this log. No code, no servers (the DB check was read-only).
- Remaining: G1 and G2 are both decided; run R0 to R8. Ask the owner which old accounts matter. Test the first real command with the Pi in a safe state.
- Mistakes & dead ends: my first Mac to Pi connectivity test hung and gave no result; I did not retry it because it is not needed for the runbook.
