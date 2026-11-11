# Audit hardening: sign-up, CSV, SSE and WebRTC caps

## [09:10] Smoke test and audit

- **Action:** read-only smoke test of the public site, droplet, DB (schema `wgw`), live MQTT frames and the Pi; read the auth, control, stream, download and register code.
- **Why:** the owner asked whether the system can be handed to a customer and what breaks at 20 cabinets.
- **Result:** four hardening gaps fixable in this repo without sudo (below) plus ops gaps that need the owner: anonymous MQTT broker (confirmed readable from the Internet), SSH with password and root login, no alerting or backups, Pi undervoltage, AI detection service crash-looping.
- **Lesson:** I first queried the `public` schema and wrongly concluded `control_audit` was missing; the app uses `search_path=wgw,public` (from `PGOPTIONS`). Check the app's own connection settings before reading a database.

## [09:50] Tests first, then fixes

- **Action:** wrote failing tests (9 red), then: `ALLOW_SELF_REGISTER=1` gate in `src/lib/auth/registration.ts` used by the page, the Server Action and the login link; CSV limited to 90 days and 200000 rows with parameters; at most 6 open `/api/status/stream` per user; `webrtcByUser` limiter (60 offers per minute) on `/api/camera/webrtc`.
- **Why:** sign-up gives any visitor a viewer account that can watch the cameras; the other three were unbounded work reachable by that account (memory in a 256 MB container, consumers on the Pi).
- **Result:** 463 tests pass (16 new), typecheck and lint clean.
- **Lesson:** a Server Action is a public POST endpoint, so a closed sign-up must be enforced in the action as well as hidden in the UI.

## Rejected options

- Admin approval queue for sign-up: needs a migration and a UI; an env switch closes the hole now and admins already create accounts.
- A per-user session table for WebRTC (as in the earlier branch): a per-minute limiter reuses `createRateLimiter` and is enough for the Pi.
- Streaming the CSV instead of bounding it: more code; the bound already caps memory.

## Summary

- Changed: `src/lib/auth/registration.ts` (new), register page/action/form, login page, `rateLimit.ts`, `api/camera/webrtc/route.ts`, `api/status/stream/route.ts`, `api/water-level/download/route.ts`, `.env.example`, tests.
- Unchanged: broker, SSH, nginx and firewall (need sudo), Pi units, the database, roles of existing users.
- Remaining: nothing in this repo; CI also runs `next build`. Production behaviour change SUPERSEDED: the owner re-opened sign-up in commit 2bbcc95 (2026-11-06) and the gate module was deleted; as of the 2026-11-11 audit, self-registration is unconditionally open (rate-limited) and this close-on-deploy behaviour no longer applies. Audit follow-up: README/.env.example/IDEA.md updated to match (finding auth.register.allow-self-register-doc-drift). Still open: anonymous broker, SSH, direct-origin access, alerting, backups, Pi power.
- Key decisions: default closed; caps reuse existing helpers; CSV window fixed at 90 days (`shortcut` comment in the route).
- Top 3 lessons:
  1. 📌 GENERAL: look up which schema/search_path the app really uses before querying its database.
  2. 📌 GENERAL: close a feature in the server entry point, not only in the UI.
  3. Bound every export and every long-lived connection that an account of the lowest role can trigger.
- Mistakes & dead ends: the wrong-schema query above; the first local `next build` failed for an environment reason (symlinked `node_modules`), so I built a clean `git archive` copy with a copy-on-write `node_modules`. That build showed `/register` as `Static`: the closed check ran before any cookie read, so Next prerendered a 404 at build time and setting `ALLOW_SELF_REGISTER=1` later could never open the page. Fixed with `export const dynamic = "force-dynamic"` and confirmed by starting the built app twice (unset: 404 and no sign-up link; `=1`: 200 and the link).
- 📌 GENERAL lesson 4: a page that reads an env var at request time must be dynamic; unit tests cannot see static prerendering, only the build output and a real start can.
