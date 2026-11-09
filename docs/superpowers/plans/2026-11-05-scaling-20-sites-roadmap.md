# Scaling 1 → 20 sites: roadmap from the current base

> **For agentic workers:** this is a roadmap plan. Each wave below gets its own detailed TDD plan (writing-plans) when the owner approves it; do not implement from this file directly. Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans per wave.

**Goal:** take `SCALING_20_SITES.md` (2026-11-04) and sequence what is still needed, measured against `origin/main` @ `a0fab3f`, the Pi and the droplet as they are on 2026-11-05.

**Architecture:** web + ops work lands in this repo first and stays backward compatible (legacy topics belong to `gate-1`), so one cabinet keeps working at every step; Pi-side work belongs to the hardware team and follows once the web side understands both topic schemes.

**Tech Stack:** Next.js 16 / TypeScript / vitest (`bun run test`), mqtt 5, Postgres, mosquitto 2.0.18, go2rtc 1.9.14, Tailscale.

**Spec:** `/Users/vactuz/Downloads/Documents/SCALING_20_SITES.md`; `docs/superpowers/specs/2026-11-04-multi-cabinet-webrtc-design.md`.

## Global Constraints
- Migrations are additive and need owner approval plus a verified backup first. No secrets, tokens or internal addresses in git. Pi and droplet `sudo` need a password: the owner runs those commands.
- No half-deploys that silence a cabinet: the web side must accept legacy and new topics before any Pi changes its topics.
- Every deploy goes through CD from `main`; no out-of-band images.

## Review Focus
- A client we did not inventory loses the broker at lockdown (a websocket consumer behind nginx `/mqtt`, one public MQTT peer, Pi units pointing at the public IP): telemetry stops silently.
- Offline alerts flap after an app restart (watcher state is in memory): needs a startup grace and de-duplication.
- A backup that was never restored is not a backup: the restore drill is part of done.
- A command for one gate reaches another (topic/ACL mismatch during the dual-topic period).
- Migration 004 applied without a fresh dump.

## Where each item stands (verified 2026-11-05)

| Doc item | Status on current base | Owner |
|---|---|---|
| 0.1 Pi topic per site | Not started. Pi uses `stm32/*`, `tank/*`, `water/gate/*`; no `SITE_ID`, no LWT. `/home/pi/stm32_bridge` is **not a git repo** | hardware team |
| 0.2 app demux per site | Not on `main` (`broker.ts` still `stm32/status/all`, `forward.ts` `stm32/cmd`, `recordLevel.ts` `device_id "stm32-radar"`, migrations 001-003 only). Built and reviewed on local branch `feat/multi-cabinet-p0-p2` (unpushed, migration 004 not applied) | this repo |
| 0.3 broker lockdown | Not done: `allow_anonymous true` on 1883 and 9001, both on 0.0.0.0; `secure.conf.staged`, `acl`, `passwd` exist; dynamic-security plugin present; a TLS listener 8883 exists. Pi units set `MQTT_HOST` to the droplet **public** IP | owner (sudo) + Pi |
| 0.4 alerting | Not started. No LWT/heartbeat on the Pi. Web already has stale detection (`isStale`) | this repo + Pi |
| 0.5 isolation proof | Needs 0.1+0.2; no fake second gate exists | this repo |
| 1.1 provision, 1.2 versions | Not started; blocked by "Pi code not in git" | hardware team |
| 1.3 SSE → polling | Not started: the hook has a HEAD probe and reconnect only; no snapshot route | this repo |
| 1.4 camera P2P | **Mostly done on `main`**: WebRTC primary, MSE fallback. Missing: per-gate go2rtc, TURN, session caps sized for 3 cameras, relay switch (built on `feat/webrtc-p2p`, to be ported) | this repo |
| 1.5 DB multi-site | Gate id + audit column in migration 004 (branch). Retention and append-only audit not done | this repo |
| 1.7 cloud | Still 1 vCPU / 961 MB (about 510 MB used, 445 MB available). **No backup job** (no cron; manual dumps only) | owner + this repo |
| 1.6, 1.8, 2.1 | Firmware / hardware | hardware team |
| 2.2-2.4 | Triggered later (see doc) | later |
| 2.5 fleet dashboard | After heartbeat exists | this repo |

## Decisions needed from the owner
- **D1 topic scheme:** keep `gate/<id>/...` (implemented, tested, ACL generator, no extra column) or switch to the doc's `site/S01/...`. Recommendation: keep `gate/<id>` and update the doc, so the hardware team reads one contract (`docs/ops/gate-topic-contract.md` on the branch).
- **D2 broker auth:** generated static ACL (in git, reviewable, fine for about 20 devices) or mosquitto dynamic-security (plugin is installed). Recommendation: static ACL now; revisit near 50 devices.
- **D3 where Pi code lives** (new repo or the hardware team's). Blocks 1.1 and 1.2.
- **D4 droplet upsize:** recommendation is defer. Media is off the server (WebRTC) and telemetry at 20 sites is about 10 msg/s (derived from the doc's 46 B / 2 s per site, not measured). Define a trigger instead: available RAM under 150 MB for a day, or load above 1.
- **D5 alert channel and off-box backup target:** Telegram bot (owner creates the token) and where dumps are copied.
- **D6 TURN (coturn): yes or no.** Needs the Pi NAT measurement first.

## Wave A: safety and visibility, no Pi change (this repo + droplet)

### A1 Database backup and restore drill
**Files:** Create `deploy/backup-db.sh` (pg_dump, gzip, mode 600, keep 14), `docs/ops/backup-restore.md`. Cron under the `cmmc` user.
**Done when:** a dump restores into a scratch database and row counts of `water_levels`, `users`, `control_audit` match; one copy exists off the droplet (D5).
**Caution:** dumps hold password hashes: 600, encrypt before leaving the box. Prerequisite for B3.

### A2 Offline and alarm alert, web side only
**Files:** Create `src/lib/telemetry/staleWatch.ts` (pure state machine), `src/lib/alerts/telegram.ts`; wire into telemetry startup. Tests for the pure part.
**Behavior:** offline after 10 min without a frame, recovery message, immediate alert on `alarm_state=1`, one merged message, 5 min grace after app start, no per-user data in messages.
**Caution:** `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` go in `app.env` (owner). It cannot see a Pi that is dead but whose last frame is retained: base it on frame time, not on retained messages. LWT arrives with Wave D.

### A3 SSE to polling fallback
**Files:** Create `src/app/api/status/route.ts` (authenticated snapshot); pure `nextTransport` helper plus tests; use it in `src/hooks/useGateStatus.ts`.
**Done when:** three SSE failures in 5 min switch to polling every 5-10 s, SSE is retried every 10 min.

### A4 Broker lockdown (owner runs the sudo steps)
**Basis:** `docs/ops/pi-droplet-alignment.md`, extended with an inventory step.
**Order:** inventory clients (6 tailnet, 1 public `1.20.222.253`, 1 loopback, 1 websocket seen now) → create credentials (app, Pi nodes, webrtc-bridge) → change Pi `MQTT_HOST` from the public IP to the tailnet address and add credentials → apply `secure.conf.staged` → close public 1883/9001 → verify telemetry and commands → rollback file ready.
**Caution:** the nginx `/mqtt` route to 9001 has an unidentified consumer; find it before closing 9001. Do it while someone can press a button and watch the dashboard.

## Wave B: multi-gate foundation (this repo)
- B1 Rebase `feat/multi-cabinet-p0-p2` onto `main` (the UI changed a lot; expect conflicts in dashboard files).
- B2 Scoped re-review of the fix wave `e6d01c9..2a0fabb`, then `bun run test`, typecheck, lint.
- B3 Owner approves migration 004 after A1; apply; verify legacy `gate-1` unchanged on the live site.
- B4 Push, PR, CD deploy. Safe before any Pi change because legacy topics map to `gate-1`.
- B5 `scripts/fake-gate.ts` (second fake gate publisher) and the isolation test of doc 0.5: 100 commands to gate A, gate B receives 0.

## Wave C: cameras per gate (after B and the NAT measurement)
- C0 Run the NAT probe on the pilot Pi and from two viewer networks (4G, office). If the Pi is symmetric/CGNAT, stop and decide D6.
- C1 Port from `feat/webrtc-p2p` commits `d5f3b1f..2968b80` into `main`'s `/api/camera/webrtc`: per-gate media (`getGateMedia`), TURN credentials, relay switch `CAMERA_RELAY_FALLBACK`.
- C2 Size the caps for 3 cameras per page: 6 per user and 6 for all viewers makes two reloads in 10 minutes return 429 and fall back to the central relay. Proposal 18 per user, 36 for viewers.
- C3 Pilot checklist `docs/ops/webrtc-site-checklist.md`; acceptance is `data-ice` of `host` or `srflx` from outside the LAN.

## Wave D: Pi and provisioning (hardware team; this repo supplies the contract and tests)
- D0 Put `/home/pi/stm32_bridge` under git (D3); remove the dead files (`mediamtx*`, `simple_*`, old `go2rtc.yml.bak*`).
- D1 `shared/topics.py` plus an env prefix; `gate-1` publishes legacy and new topics during the transition.
- D2 LWT + heartbeat + version stamp; the A2 watcher then also uses LWT.
- D3 `provision.sh` and golden image; one MQTT credential per gate from the ACL generator.

## Wave E: later
Admin enrollment screen, fleet dashboard (2.5), retention policy (1.5), upsize by the D4 trigger, PDPA pack (2.4), HA (2.3).

## Not in this plan
Firmware items (1.6, 2.1), physical safety (1.8), hardware cost, mTLS (2.2).

## Order and dependencies
A1 → B3. A4 before provisioning real credentials (D3). B before C1 and before any non-`gate-1` Pi (D1). A2 and A3 can start now and ship independently.
