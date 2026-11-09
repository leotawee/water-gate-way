# Multi-cabinet registry and peer-to-peer camera streaming

Date: 2026-11-04 · Status: **DRAFT, not approved** · Scope: web app + provisioning design (Pi code belongs to the hardware team; this spec states what it must do, it does not change it)

## Intent

Grow from one cabinet to about 20. Each cabinet is a Raspberry Pi + STM32 + 3 cameras + sensors, like today's `gate-1`. The central server must not carry video, because installed cameras (about 60) would make bandwidth cost scale with the fleet.

Success looks like:
1. Adding cabinet N is a documented procedure with no code change: an admin registers it, runs one provisioning step on its Pi, and it appears online.
2. A viewer sees live video of any cabinet; in the normal case the video does not pass through the central server.
3. Telemetry, commands, audit rows and water-level history are per cabinet. A device can publish only for its own cabinet, and a command for `gate-3` can never reach `gate-5`.
4. Central cost scales with viewers and telemetry, not with installed cameras.

## What exists (verified 2026-11-04)

- **Registry:** table `gates` (`id` matching `gate-N`, `name`, `location`, `lat`, `lng`, `has_device`, `active`, `updated_at`), admin page `src/app/admin/gates/page.tsx`, dashboard route `/dashboard?gate=gate-N` that 404s for inactive or unknown gates. Migration `db/migrations/002_admin.sql` states only `gate-1` has an STM32 and cameras.
- **Still single-cabinet:** command topic `stm32/cmd` (`src/lib/control/forward.ts:7`), status topic `stm32/status/all` (`src/lib/telemetry/broker.ts:20`), camera list `office1-3` (`src/lib/gates.ts:4`), one `GO2RTC_URL` in `app.env`, and `/api/water-level` reads `water_levels` with no gate filter (`src/app/api/water-level/route.ts`). Whether `water_levels` has a gate column was **not checked**.
- **Camera path today:** Tapo RTSP → go2rtc on the Pi → fragmented MP4 over HTTP across the tailnet → Next.js relay → browser. The relay caps 6 streams per user, 12 in total.
- **Measured (one camera, 24 s, static scene, coarse reads):** H.264 video plus PCMA audio, about 45–65 kbit/s. Treat as a lower bound; motion raises it.
- **Broker:** accepts anonymous clients from the internet today; `docs/ops/pi-droplet-alignment.md` closes it. This spec assumes that runbook is done first.

## Assumptions (confirm before planning)

- A1. Every cabinet's Pi can join the owner's Tailscale network. **Confirmed by the owner (2026-11-04).** The design therefore uses one central broker over the tailnet.
- A2. All cabinets use the same Pi software image and the same camera model family.
- A3. All logged-in users may see all cabinets (today's roles are `viewer` < `operator` < `admin`, with no per-cabinet permission).
- A4. Database migrations are additive and need the owner's approval before they run.

## Design

### 1. Registry

Extend `gates` additively (migration, owner approval):
- `media_base_url text` (go2rtc API base the server reaches over the tailnet; null until enrolled)
- `cameras text[] not null default '{}'` (go2rtc stream names for this cabinet)
- `enrolled_at timestamptz`, `last_seen_at timestamptz`

New table `gate_enrollments(gate_id, token_hash, expires_at, used_at)`.

Admin flow (an extension of `/admin/gates`):
1. Admin creates the gate (name, location, coordinates). The id is the next free `gate-N`. `has_device` stays false.
2. Admin presses "Enroll". The server creates a one-time token valid 24 h, stores only its hash, and shows the token **once** with the provisioning command. The action is written to `admin_audit`.
3. On the Pi the installer exchanges the token for a per-cabinet broker credential (username equals the gate id), writes its unit files with the cabinet's topic prefix, and renders `go2rtc.yml` from a template. The camera RTSP addresses and passwords are typed on the Pi and **never sent to the server**.
4. The Pi connects. The server marks `has_device = true`, sets `enrolled_at`, and updates `last_seen_at` from telemetry. The admin page shows online or offline from `last_seen_at`.
5. Decommission: set `active = false`, delete the broker user, delete unused enrollments.

### 2. Telemetry and commands per cabinet

- Topics move under a gate prefix: `gate/<id>/status`, `gate/<id>/cmd`, `gate/<id>/person`. The Pi services take the prefix from an environment variable. `gate-1` publishes both the legacy and the new topics during migration, then the legacy ones are dropped.
- The server subscribes to `gate/+/status` and takes the gate id **from the topic, never from the payload**. The broker ACL gives user `gate-N` read/write on `gate/gate-N/#` only, so a device cannot speak for another cabinet.
- `/api/status/stream?gate=<id>` streams one cabinet. `POST /api/control` gains a `gate` field; the server checks the gate is active and enrolled, then publishes to `gate/<id>/cmd`. `control_audit` gets a `gate_id` column.
- `water_levels` already has a `device_id` column (today every row is written as `'stm32-radar'`). It becomes the gate id: existing rows are backfilled to `'gate-1'`, new rows carry the gate id, and an index on `(device_id, measured_at)` is added. All queries and the CSV download filter by it. No new column.
- First version uses **one central broker** over the tailnet (A1 is confirmed). A local broker per cabinet forwarding over HTTPS stays a future option only if a site ever cannot join the tailnet.

### 3. Video

- **Grid view:** JPEG snapshots, not video. `GET /api/camera/snapshot?gate&camera` returns go2rtc's frame, cached on the server for 5 s and shared by all viewers, so the cost depends on cameras being watched, not viewers.
- **Live view:** on click, WebRTC through go2rtc. `POST /api/camera/webrtc` takes `{gate, camera, offer}`, checks login and role, checks `camera` is in that gate's `cameras`, forwards the SDP to `<media_base_url>/api/webrtc?src=<camera>` over the tailnet, and returns the answer plus ICE servers. Media flows between browser and Pi.
- **ICE:** STUN plus a TURN server with time-limited credentials issued by the signalling endpoint. TURN carries the connections that cannot go direct; its host is open question Q4.
- **Fallback:** if ICE does not connect within 10 s, the player offers the existing fragmented-MP4 relay, generalised with a `gate` parameter and keeping the stream limits, so a cabinet behind CGNAT still works at server cost.
- **Accepted limitation:** the web app cannot end a peer connection that is already up. Signalling tokens expire, which stops new connections only. A user signed out mid-stream keeps the stream until it ends. Open question Q6 asks whether go2rtc can drop a consumer through its API.

### 4. Capacity model

Server egress is (snapshots: each camera at most once per 5 s while watched, about 20 KB) + (TURN-relayed live streams × bitrate) + (fallback relay streams × bitrate) + telemetry (kilobytes per minute per cabinet). Each cabinet's uplink carries (concurrent viewers × bitrate). An always-on 1 Mbit/s stream is about 324 GB per month, which is what the design avoids. Inputs still to measure: bitrate with motion, the share of viewers who need TURN, and each site's real uplink.

### 5. Network (tailnet)

- Every cabinet's Pi joins the tailnet with the existing tag `tag:wgw-device`; the droplet is `tag:wgw-server` (tags and the least-privilege rules are documented in `deploy/pull/README.md`). The existing rules already cover N cabinets: `tag:wgw-device → tag:wgw-server:1883` (publish telemetry) and `tag:wgw-server → tag:wgw-device:1984` (go2rtc API, for snapshots and signalling).
- **Required addition:** no rule may allow `tag:wgw-device → tag:wgw-device`. With 20 cabinets, one compromised Pi must not reach another Pi's go2rtc or SSH. Whether the current policy file already denies this was not checked; confirm it in the Tailscale admin before the second cabinet joins.
- Viewers' browsers are **not** on the tailnet. Tailscale carries the signalling and the telemetry, but the WebRTC media still needs a direct UDP path from the viewer to the Pi, or TURN. The tailnet does not remove the NAT question for video.

### 6. Security

- Broker authentication on, anonymous off, ACL per gate prefix (prerequisite: the ops runbook).
- Enrollment token: one-time, hashed, 24 h, shown once, audited. Camera credentials stay on the Pi.
- go2rtc's API stays on the tailnet and LAN only; only the WebRTC UDP port is exposed.
- Gate ids use the existing `^gate-[0-9]{1,4}$` check; camera names come from the registry, never from the client.
- No internal addresses, passwords or tokens in the repo.

## Delivery in phases (each shippable alone)

- P0: broker lockdown (`docs/ops/pi-droplet-alignment.md`).
- P1: registry columns, per-gate topics with `gate-1` dual-publish, per-gate ACL.
- P2: per-gate telemetry, commands, audit, and `water_levels`.
- P3: snapshots, WebRTC signalling, TURN, relay fallback.
- P4: provisioning installer and the admin enrollment screen.
- P5: pilot with a second cabinet; measure bitrate, TURN share, and uplink; then roll out.

## Testing

Unit tests: topic → gate id parsing, gate and camera validation, enrollment token lifecycle (expiry, single use, hash only), signalling authorization, ACL generation. Integration: a command for one gate does not appear on another. WebRTC and TURN are verified in the pilot, not in unit tests (the repo's vitest has no DOM).

## Out of scope

STM32 firmware, per-cabinet user permissions, broker high availability, video recording, a mobile app.

## Open questions

- Q1. ~~Can every cabinet's Pi join the tailnet?~~ **Resolved: yes** (owner, 2026-11-04). Central broker over the tailnet.
- Q2. Expected concurrent viewers (drives TURN sizing and the fallback limits).
- Q3. Do viewers need per-cabinet permissions?
- Q4. Where does TURN run, and what is the monthly cost ceiling?
- Q5. Does the provisioning installer live in this repo or in the hardware team's repo (the Pi code is theirs)?
- Q6. Can go2rtc drop a consumer through its API, to revoke a signed-out user's stream?
- Q7. ~~Does `water_levels` already have a gate column?~~ **Resolved:** no gate column, but `device_id` exists and is reused (see section 2).
