# 2026-10-30 — REA recon of map.hyxc.io + rebuild plan

## [14:22] Public recon with REA

- **Action:** `capture_browser_scenario` (launch, Playwright Chromium) on `http://map.hyxc.io/`; `openssl s_client`; `curl` of `/login` and its `_next/static` chunks.
- **Why:** owner wants a remake; first establish what the live app is before touching code.
- **Result:** navigation failed `net::ERR_CERT_DATE_INVALID` (cert `CN=hyxc.io`, expired 2026-08-17). Site is Next.js/Turbopack behind nginx 1.24, `/` → 307 `/login`, cookie `wg_session`, Server Actions `signIn/signUp/signOut/getCurrentUser`.
- **Lesson:** a failed REA navigation is still evidence — the partial observation carried the TLS failure reason.

## [14:23] Dead end: full bundle analysis

- **Action:** `analyze_javascript_application` (summary) on downloaded chunks.
- **Result:** host tool deadline hit ("Request timed out"). Not repeated, per REA guidance; fell back to targeted `grep` of minified chunks.
- **Lesson:** for a quick question (endpoints, topics), grep on minified chunks is faster than a full graph build.

## [14:24] Deployed source search

- **Action:** `git fetch upstream`, `git ls-remote`, `git grep` for auth code.
- **Result:** neither `origin` nor `upstream` contains the auth layer; live build is unpushed.

## [14:25] Credential handling decision

- **Action:** declined to type the user-supplied admin password into the production login; launched an isolated Chromium (temp profile, CDP on 127.0.0.1:9222) for Leo to log in himself.
- **Why:** agent policy forbids entering passwords on production hosts, sandbox or not.
- **Lesson:** 📌 GENERAL: when a site needs auth for analysis, let the human authenticate in an isolated, loopback-only debug browser and attach to it.

## [14:29] Authenticated capture

- **Action:** `inspect_web_page` + `capture_web_screenshot` on the logged-in `/dashboard` tab; grep of dashboard chunks; unauthenticated handshake/GET probes (no MQTT CONNECT, no command POST).
- **Result:** browser MQTT to `wss://map.hyxc.io/mqtt` with no credentials, publishes `stm32/cmd`; `/mqtt` handshake → 101 without cookie (P0). `/api/water-level` → 200 without cookie. `/ws/detections` → 502. UI bugs: "Unknown Gate", 0 shown as "—", cameras failing.
- **Lesson:** a login page means nothing if the actuator channel (MQTT/WebSocket) bypasses it — always trace where commands actually go. The attack prevented: anyone who reads the public JS can switch real pumps.

## [14:40] Repo read for plan

- **Action:** read `src/app/dashboard/page.tsx`, `src/hooks/useMqtt.ts`, API routes, `ai-receiver/main.py`, Next 16 proxy docs.
- **Result:** repo matches the live dashboard minus auth. Extra P0: FastAPI binds `0.0.0.0`, CORS `*`, unauthenticated `/api/control` and `/api/update-count`.

## [14:45] Wrote plan

- **Action:** created `docs/superpowers/plans/2026-10-30-secure-rebuild.md`.
- **Why:** writing-plans skill; security fixes first, then refactor.
- **Decisions (mini-ADR):**
  - SSE from a server-side MQTT subscriber instead of browser MQTT with read-only creds — rejected option leaks creds in the bundle.
  - scrypt (built in) over argon2id — rejected option needs a native dependency.
  - Keep `pg` over postgres.js/Drizzle — switching adds churn without security gain (TECH DEBT noted).
  - No public sign-up — pending owner decision.

## Summary

- Changed: added this log and the plan doc. Unchanged: all application code.
- Remaining: owner Phase 0 containment; plan approval; execution.
- Top 3 lessons:
  1. 📌 GENERAL: auth on the UI does not protect side channels (MQTT, direct backend ports).
  2. 📌 GENERAL: zero vs missing must be separate states (`number | null`), never `?? 0`.
  3. Partial REA evidence (failed navigation) still answers questions.
- Mistakes & dead ends: full REA JS analysis timed out; several `capture_browser_scenario` schema guesses rejected before finding the documented shape in the skill references.
