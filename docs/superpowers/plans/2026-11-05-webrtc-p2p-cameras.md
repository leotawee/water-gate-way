# WebRTC peer-to-peer cameras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Camera video flows between the viewer's browser and the cabinet's go2rtc directly (WebRTC), never through the central server; the server only authorizes and relays the small SDP offer/answer.

**Architecture:** A new authenticated route `POST /api/camera/webrtc` validates gate, camera and user, forwards the browser's SDP offer to that gate's go2rtc over the tailnet (`/api/webrtc?src=<camera>`), and returns go2rtc's SDP answer plus ICE servers (STUN, optional time-limited TURN). A new player tries WebRTC first and, when ICE fails, falls back to the existing fragmented-MP4 relay only if the operator allows it (`CAMERA_RELAY_FALLBACK`). Per-gate go2rtc address and camera list come from the gate registry.

**Tech Stack:** Next.js 16.4.3 App Router, React 19, TypeScript, vitest 4 (node environment, `src/**/*.test.ts`, no DOM), go2rtc on each Raspberry Pi, optional coturn.

**Spec:** `docs/superpowers/specs/2026-11-04-multi-cabinet-webrtc-design.md` (section 3, Video). Also `SCALING_20_SITES.md` item 1.4 (owner's scaling plan: WebRTC P2P per site, TURN fallback, staff over tailnet).

## Feasibility (what was measured, what was not)

- **Possible in principle:** go2rtc on the Pi already listens for WebRTC (`:8555` UDP and TCP, STUN candidate configured in its `go2rtc.yml`) and the camera codec is H.264 (+PCMA audio), which browsers decode without transcoding. The signalling payload is a few KB.
- **The reason it was not used before:** the current relay route says "WebRTC needs a UDP path from the browser to the Pi (ICE/TURN)". Each cabinet's Pi sits behind a site router. Whether a viewer on 4G or an office network can reach it depends on that router's NAT.
- **NOT measured:** the Pi's NAT type. `wgw-pi` was offline on the tailnet ("offline, last seen 17h ago") when this plan was written, so the probe could not run on it. The probe method was validated only on the author's own network (endpoint-independent mapping, not evidence for any site). Task 1 makes that measurement the first gate.
- **Also not verified:** the exact request and response format of go2rtc's `/api/webrtc` on the installed version (the Pi was unreachable). Task 1 records it from go2rtc's own test page before any route code is written.
- **Consequence:** P2P works for viewers whose path to the Pi allows UDP hole punching. Everyone else needs TURN (relayed through a server, so bandwidth is not zero) or the old relay. This plan makes both explicit, capped and switchable instead of hidden.

## Global Constraints

- Gates before every commit: `bun run typecheck`, `bun run lint`, `bun run test` (vitest; not `bun test`). Skim `node_modules/next/dist/docs/01-app` for route handlers before Task 4 (Next.js 16 has breaking changes; use only APIs already in this repo).
- Preconditions (check in Task 1): branch `feat/multi-cabinet-p0-p2` is merged (provides `isGateId`, per-gate `getGate`, the gates registry and migration 004 with `gates.media_base_url` and `gates.cameras`). If migration 004 is not applied, `getGateMedia` must still work for `gate-1` from the environment (Task 3).
- Media never passes through the central server in the WebRTC path. The server forwards only SDP text (max 16 KiB) and never logs SDP, ICE candidates, TURN credentials or camera names with credentials.
- go2rtc's HTTP API (`:1984`) stays reachable only from the tailnet and the site LAN. Browsers never call it directly; only the server does, with `redirect: "error"` and a 10 s timeout.
- TURN credentials are time-limited (coturn REST scheme), TTL 600 s, derived on the server; the shared secret never reaches the client. The TURN server must deny relaying to private and tailnet ranges (documented in Task 7).
- Gate id format `^gate-[0-9]{1,4}$`; camera names `^[A-Za-z0-9_-]{1,40}$`; the camera must belong to the requested gate.
- No internal addresses, passwords or tokens in the repo or commit messages (use `<PLACEHOLDERS>` in docs).
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Pushing, merging, deploying, sudo and router changes need the owner's explicit OK.

## Review Focus

- A request for a camera that is not in the requested gate's list (or another gate's camera) returns 400 and nothing is forwarded to go2rtc (Task 4).
- go2rtc unreachable, slow (over 10 s), returning non-2xx, or returning a body that is not an SDP answer gives 502 within the timeout, logs no SDP, and does not leak a session slot (Task 4).
- Session limits: per-user and viewer-pool limits are enforced and expire by TTL, so a closed tab cannot hold a slot forever and a signed-out user gets no new session (Task 4).
- ICE fails and the relay fallback is disabled: the tile shows a visible failure, not an endless spinner (Task 5).
- The TURN shared secret and other users' ids never appear in the response; credentials expire (Task 2).

## Out of scope (decide after the pilot)

- JPEG snapshots for the camera grid with live video only on click (cuts site uplink; spec section 3). Added only if the pilot shows the uplink is the limit.
- Revoking a peer connection that is already up when a user is signed out or disabled. Signalling stops at once and the browser tears down at `ttlSec`, but go2rtc keeps an established session until it ends. Whether go2rtc can drop a consumer through its API is an open question for the pilot.
- A client-to-server report of the selected candidate type (TURN share metric). The pilot reads `data-ice` by hand; add a report endpoint only if the 20-site decision needs fleet numbers.
- Provisioning of go2rtc and router settings on new cabinets (the installer is separate work).

## File Structure

| File | Responsibility |
|---|---|
| `scripts/ops/nat_probe.py` (new) | STUN-only NAT classifier, run on a Pi and on viewer networks |
| `src/lib/webrtc/signaling.ts` (new) | pure helpers: go2rtc URL, SDP checks, ICE server list, TURN credential |
| `src/lib/gatesDb.ts` | add `getGateMedia(id)` |
| `src/app/api/camera/webrtc/route.ts` (new) | authenticated SDP exchange with go2rtc |
| `src/lib/webrtc/playerMode.ts` (new) | pure `nextMode`, `selectedCandidateType` |
| `src/components/WebRtcPlayer.tsx` (new) | browser RTCPeerConnection player |
| `src/app/dashboard/_components/CameraTile.tsx` (new), `CameraGrid.tsx`, `src/app/dashboard/page.tsx`, `DashboardClient.tsx` | WebRTC first, relay fallback, per-gate camera list |
| `src/app/api/camera/stream/route.ts` | per-gate relay and the `CAMERA_RELAY_FALLBACK` switch |
| `docs/ops/webrtc-site-checklist.md` (new) | go2rtc and router settings, coturn, pilot matrix |

---

### Task 1: Measurement gate (no production code)

**Files:**
- Create: `scripts/ops/nat_probe.py`

**Interfaces:**
- Produces: a script runnable with stock Python 3 (`python3 -I scripts/ops/nat_probe.py`), exit code 0 = endpoint-independent mapping, 1 = per-destination mapping (symmetric/CGNAT), 2 = inconclusive; `--selftest` exits 0 when the STUN parser passes its vector.

- [ ] **Step 1: Write the self-check first.** `--selftest` builds a STUN binding success response whose XOR-MAPPED-ADDRESS encodes `203.0.113.9:54321` (port bytes `F5 23`, address bytes `EA 12 D5 4B`, magic cookie `0x2112A442`) and asserts the parser returns `("203.0.113.9", 54321)`; a response with a different transaction id returns `None`. Run `python3 -I scripts/ops/nat_probe.py --selftest`. Expected: FAIL (script missing).
- [ ] **Step 2: Implement** the probe: one UDP socket, a binding request to `stun.l.google.com:19302`, `stun1.l.google.com:19302` and `stun.cloudflare.com:3478`, compare mapped address and port, print each result and one `RESULT:` line, return the exit codes above. A validated draft exists at `/private/tmp/claude-501/-Users-vactuz-VSCode-water-gate-way/c23b3aee-0c17-40f4-88ba-5b2e95be2bc9/scratchpad/nat_probe.py` (may be gone; the behaviour above is the requirement).
- [ ] **Step 3: Run** `--selftest`. Expected: exit 0, PASS.
- [ ] **Step 4: Commit** `feat(ops): STUN-only NAT probe for WebRTC site checks`.
- [ ] **Step 5: Owner measurements (record results in `docs/ops/webrtc-site-checklist.md` Task 7 table; nothing is decided until these exist):**
  1. On each pilot Pi: `python3 -I nat_probe.py` (the Pi must be online).
  2. On two typical viewer networks (a phone on mobile data, an office or home Wi-Fi): the same probe.
  3. Open go2rtc's own test page `http://<PI_TAILNET_ADDRESS>:1984/` for `office1` from a tailnet device; in the browser's network tab record the `/api/webrtc` request `Content-Type`, body shape and the response status, `Content-Type` and body shape. Expected: the SDP exchange format this plan assumes (offer as `application/sdp`, answer as an SDP body starting `v=0`). If it differs, edit the Task 2 and Task 4 text before implementing.
  4. **Go/no-go:** go if the Pi and the main viewer networks show endpoint-independent mapping; if some do not, still go but TURN (Task 7) becomes mandatory for them; if the Pi itself is symmetric/CGNAT, stop and use Tailscale for viewers instead.

---

### Task 2: Signalling helpers (pure)

**Files:**
- Create: `src/lib/webrtc/signaling.ts`
- Test: `src/lib/webrtc/signaling.test.ts`

**Interfaces:**
- Produces:
  - `export const MAX_SDP_BYTES = 16384`, `export const TURN_TTL_SEC = 600`
  - `export function go2rtcWebrtcUrl(baseUrl: string, camera: string): string` → `<base without trailing slashes>/api/webrtc?src=<encodeURIComponent(camera)>`
  - `export function isSdp(v: unknown): v is string` (a string, at most `MAX_SDP_BYTES` UTF-8 bytes, starts with `v=0`, no NUL)
  - `export function isOfferSdp(v: unknown): v is string` (`isSdp` and contains an `m=video` line)
  - `export function turnCredential(secret: string, userId: string, nowMs: number, ttlSec: number): { username: string; credential: string }` (coturn REST scheme: `username = "<expiryEpochSec>:<userId>"`, `credential = base64(HMAC-SHA1(secret, username))`)
  - `export type IceServer = { urls: string[]; username?: string; credential?: string }`
  - `export function buildIceServers(env: { WEBRTC_STUN_URLS?: string; TURN_URLS?: string; TURN_SECRET?: string }, userId: string, nowMs: number): IceServer[]`

- [ ] **Step 1: Write the failing tests.** `go2rtcWebrtcUrl("http://h:1984//", "office 1")` → `"http://h:1984/api/webrtc?src=office%201"`. `isSdp`: true for `"v=0\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n"`; false for `""`, `42`, a body not starting `v=0`, a string over 16384 bytes, one containing `\u0000`. `isOfferSdp`: false for an SDP without `m=video`. `turnCredential("s3cret", "user-1", 1700000000000, 600)` → `{ username: "1700000600:user-1", credential: "tdZNzWYvEosp1bAlWIoGlMc8d/g=" }`. `buildIceServers`: with no env → one entry `{ urls: ["stun:stun.l.google.com:19302"] }`; `WEBRTC_STUN_URLS="stun:a:1,stun:b:2"` → one entry with both URLs; entries not starting `stun:`, `turn:` or `turns:` are dropped; with `TURN_URLS="turn:t:3478?transport=udp"` and `TURN_SECRET="s3cret"` a second entry carries `username` and `credential` for that user, and the secret string appears nowhere in the returned JSON (`JSON.stringify(result)` does not contain `"s3cret"`); `TURN_URLS` without `TURN_SECRET` adds no TURN entry.
- [ ] **Step 2: Run** `bun run test src/lib/webrtc/signaling.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the signatures above with `node:crypto` HMAC; no new dependency.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(webrtc): signalling helpers`.

---

### Task 3: Per-gate media lookup

**Files:**
- Modify: `src/lib/gatesDb.ts`
- Test: `src/lib/gatesDb.test.ts`

**Interfaces:**
- Consumes: `GATE_ID_RE`, `CAMERAS` from `src/lib/gates.ts`; `db` from `@/lib/db`.
- Produces: `export async function getGateMedia(id: string): Promise<{ baseUrl: string; cameras: string[] } | null>`

- [ ] **Step 1: Write the failing tests** (mock `@/lib/db`): inactive, unknown or malformed id → `null`; a row with `media_base_url` `"http://pi-a:1984"` and `cameras` `["cam1","cam2"]` → `{ baseUrl: "http://pi-a:1984", cameras: ["cam1","cam2"] }`; for `gate-1` with null columns and `GO2RTC_URL` set → baseUrl from the env and `cameras` equal to `CAMERAS`; for `gate-2` with null columns → `null`; a `media_base_url` with embedded credentials (`http://u:p@h`) or a non-http(s) scheme → `null`; camera names failing `^[A-Za-z0-9_-]{1,40}$` are filtered out; a database error with `code === "42703"` (migration 004 not applied) behaves like null columns; any other database error is rethrown.
- [ ] **Step 2: Run** `bun run test src/lib/gatesDb.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `getGateMedia` with one parameterized query on `gates` (`id`, `media_base_url`, `cameras`, active only). Strip trailing slashes from the base URL.
- [ ] **Step 4: Run** the test, then `bun run test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(gates): per-gate go2rtc address and camera list`.

---

### Task 4: Signalling route

**Files:**
- Create: `src/app/api/camera/webrtc/route.ts`
- Test: `src/app/api/camera/webrtc/route.test.ts`

**Interfaces:**
- Consumes: `isGateId`, `getGateMedia`, `go2rtcWebrtcUrl`, `isOfferSdp`, `isSdp`, `buildIceServers`, `TURN_TTL_SEC`, `requireUser`/`authErrorResponse` from `@/lib/auth/dal`, `sameOrigin` from `@/lib/http/sameOrigin`.
- Produces two handlers in one route file (the browser needs the ICE servers BEFORE it creates the offer, because the offer only carries the candidates gathered up to that moment):
  - `GET /api/camera/webrtc` (auth required) → `200 { iceServers: IceServer[], ttlSec: 600, fallback: boolean }` where `fallback` is `process.env.CAMERA_RELAY_FALLBACK !== "0"` and TURN entries are per-user, time-limited.
  - `POST /api/camera/webrtc` with JSON body `{ gate?: string, camera: string, sdp: string }` (missing `gate` means `gate-1`) → `200 { sdp: string, ttlSec: 600 }`.
  - Errors, all `{ error: <code> }`: 403 `forbidden` (cross-site), 401/403 from auth, 400 `invalid_request` / `invalid_gate` / `invalid_camera` / `invalid_sdp`, 404 `unknown_gate`, 429 `too_many_sessions`, 502 `camera_unavailable`, 503 `unavailable`.

- [ ] **Step 1: Write the failing tests** (mock `@/lib/auth/dal`, `@/lib/gatesDb`, `@/lib/http/sameOrigin`, global `fetch`): a valid request forwards to `go2rtcWebrtcUrl(baseUrl, "cam1")` with method POST, header `Content-Type: application/sdp`, the offer as body, `redirect: "error"`, and returns the answer in `sdp`; an unauthenticated caller gets the dal response and `fetch` is never called; `gate: "x"` → 400 `invalid_gate`; unknown gate (`getGateMedia` null) → 404 and no fetch; camera not in the gate's list → 400 `invalid_camera` and no fetch; a camera of another gate → 400 and no fetch; `sdp` not an offer → 400 `invalid_sdp`; `fetch` rejects, aborts after 10 s (fake timers), or answers 500 → 502 and the SDP never appears in `console.error` calls; go2rtc answering a body that is not an SDP → 502; the 7th concurrent session for one user in 10 minutes → 429 and, after advancing fake timers past 600 s, a new session is accepted; viewers share a pool of 6 sessions while operators are not limited by it; `GET` without a session returns the dal response; `GET` for a signed-in user returns `iceServers` with TURN entries only when `TURN_URLS` and `TURN_SECRET` are set, the TURN username contains that user's id and an expiry about 600 s ahead, the response never contains the TURN secret, and `fallback` is false when `CAMERA_RELAY_FALLBACK="0"`.
- [ ] **Step 2: Run** `bun run test src/app/api/camera/webrtc`. Expected: FAIL.
- [ ] **Step 3: Implement** the route. `POST` order: `sameOrigin` → `requireUser()` → parse and validate the body → `getGateMedia` → camera membership → session limit → forward. `GET` order: `requireUser()` → build ICE servers. Count a session at `POST` only. Session limit is an in-process `Map<userId, number[]>` of expiry timestamps pruned on each call (`// TECH DEBT: in-process; move to Redis when horizontally scaled`), `MAX_SESSIONS_PER_USER = 6`, `MAX_VIEWER_SESSIONS = 6` shared by all viewers. Log only fixed labels and error names.
- [ ] **Step 4: Run** the route tests, then `bun run test`, `bun run typecheck`, `bun run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(camera): authenticated WebRTC signalling route`.

---

### Task 5: Player logic and component

**Files:**
- Create: `src/lib/webrtc/playerMode.ts`, `src/components/WebRtcPlayer.tsx`, `src/app/dashboard/_components/CameraTile.tsx`
- Modify: `src/app/dashboard/_components/CameraGrid.tsx`
- Test: `src/lib/webrtc/playerMode.test.ts`

**Interfaces:**
- Produces:
  - `export type PlayerMode = "webrtc" | "relay" | "failed"`; `export type PlayerFailure = "ice-failed" | "timeout" | "unavailable"`
  - `export function nextMode(mode: PlayerMode, failure: PlayerFailure, relayAllowed: boolean): PlayerMode` (webrtc plus any failure → `"relay"` when `relayAllowed`, else `"failed"`; `relay` and `failed` stay as they are)
  - `export type CandidateType = "host" | "srflx" | "prflx" | "relay"`; `export function selectedCandidateType(stats: Iterable<Record<string, unknown>>): CandidateType | null` (follows `transport.selectedCandidatePairId` → `candidate-pair.localCandidateId` → `local-candidate.candidateType`; when no transport entry exists, uses the pair with `nominated === true` and `state === "succeeded"`)
  - `WebRtcPlayer` props `{ gateId: string; camera: string; label: string; onFail: (f: PlayerFailure, fallback: boolean) => void }`; `CameraTile` props `{ gateId: string; camera: string; label: string }`; `CameraGrid` props `{ gateId: string; cameras: readonly string[] }`.

- [ ] **Step 1: Write the failing tests** for `nextMode` (all 3 failures × relay allowed or not, plus `relay` and `failed` staying) and `selectedCandidateType` (a `relay` pair, a `host` pair, the nominated-pair fallback, an empty list → `null`).
- [ ] **Step 2: Run** `bun run test src/lib/webrtc/playerMode.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the two pure functions.
- [ ] **Step 4: Run** the test. Expected: PASS.
- [ ] **Step 5: Implement `WebRtcPlayer`** (client component; no DOM tests exist in this repo, so verification is typecheck, lint and the pilot): first `GET /api/camera/webrtc` for `{ iceServers, ttlSec, fallback }` (if it fails, call `onFail("unavailable", true)`), then one `RTCPeerConnection({ iceServers })` with a `recvonly` video transceiver only, create the offer, wait for ICE gathering to complete or 2 s, `POST { gate, camera, sdp }` to `/api/camera/webrtc`, set the remote answer; `<video muted playsInline autoPlay>` with `srcObject` from `ontrack`; call `onFail("timeout")` if not `connected` within 10 s, `onFail("ice-failed")` on `connectionState === "failed"`, `onFail("unavailable")` on 429, 502 or 503; pass `fallback` from the GET response; close the connection when the tab is hidden, on unmount, and after `ttlSec` (then negotiate a new session; `// shortcut: a visible reconnect once per TTL, upgrade to ICE restart if the pilot shows it is noticeable`); set `data-ice` from `selectedCandidateType(await pc.getStats())` once connected. Read how `Go2RTCPlayer` handles hidden tabs and reuse the same pattern.
- [ ] **Step 6: Implement `CameraTile`:** holds `mode` state starting `"webrtc"`; renders `WebRtcPlayer` while `webrtc`, the existing `Go2RTCPlayer` (unchanged, `streamName={camera}`) while `relay`, and a fixed Thai message `ภาพกล้องเชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง` with a retry button while `failed`; `onFail` calls `nextMode(mode, failure, fallback)`. `CameraGrid` maps `cameras` to `CameraTile` with position labels `กล้อง N`, keeping the existing layout classes.
- [ ] **Step 7: Gates** `bun run typecheck`, `bun run lint`, `bun run test`. Expected: PASS.
- [ ] **Step 8: Commit** `feat(camera): WebRTC player with relay fallback`.

---

### Task 6: Per-gate relay and page wiring

**Files:**
- Modify: `src/app/api/camera/stream/route.ts`, `src/app/dashboard/page.tsx`, `src/app/dashboard/DashboardClient.tsx`
- Test: `src/app/api/camera/stream/route.test.ts` (new)

**Interfaces:**
- Consumes: `getGateMedia` (Task 3), `isGateId`.
- Produces: `GET /api/camera/stream?src=<camera>&gate=<id>` (missing `gate` = `gate-1`): invalid gate → 400 `invalid_gate`; unknown gate or camera not in the gate's list → 400 `invalid_src` / 404 `unknown_gate`; `CAMERA_RELAY_FALLBACK === "0"` → 404 `relay_disabled`, checked after auth; the upstream is `<baseUrl>/api/stream.mp4?src=<camera>` from `getGateMedia`. `DashboardClient` receives a `cameras: readonly string[]` prop and passes `gateId` and `cameras` to `CameraGrid`; `Go2RTCPlayer` appends `&gate=<gateId>` to its stream URL (add an optional `gateId` prop).

- [ ] **Step 1: Write the failing tests** (mock `@/lib/auth/dal`, `@/lib/gatesDb`, global `fetch`): `gate: x` → 400; unauthenticated → dal response before any gate lookup; `CAMERA_RELAY_FALLBACK="0"` → 404 and `fetch` never called; a camera outside the gate's list → 400; a valid request fetches `<baseUrl>/api/stream.mp4?src=<camera>` of that gate and not the env default; default gate is `gate-1`; the existing per-user and total stream limits still apply (one test).
- [ ] **Step 2: Run** `bun run test src/app/api/camera/stream`. Expected: FAIL.
- [ ] **Step 3: Implement** the route changes (keep the existing limits and idle and lifetime cuts untouched), `page.tsx` (call `getGateMedia(gate.id)`, fall back to `[...CAMERAS]` for `gate-1` on null or error, pass `cameras`), and the prop plumbing. Re-read `DashboardClient.tsx` first; other work touches it.
- [ ] **Step 4: Run** `bun run test`, `bun run typecheck`, `bun run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(camera): per-gate relay and camera list, relay can be disabled`.

---

### Task 7: Site checklist, TURN and pilot

**Files:**
- Create: `docs/ops/webrtc-site-checklist.md`

**Interfaces:** documentation only; nothing here is executed by this plan.

- [ ] **Step 1: Write the document** (placeholders only: `<PI_TAILNET_ADDRESS>`, `<DROPLET_PUBLIC_ADDRESS>`, `<SITE_ROUTER>`): (1) the `go2rtc.yml` `webrtc:` block (listen `:8555`, STUN candidate, optional static public candidate when a port is forwarded) and the required Tailscale rule (`tag:wgw-server` → device `:1984` only; viewers never reach `:1984`); (2) router options for each site: UDP and TCP `8555` forward (best), or none (hole punching via STUN, may fail); (3) coturn: install, `use-auth-secret` with `static-auth-secret` equal to the web app's `TURN_SECRET`, `realm`, listening `3478` plus a limited relay port range, `denied-peer-ip` for `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `100.64.0.0/10`, `127.0.0.0/8`, `no-multicast-peers`, `total-quota` and `bps-capacity` caps sized from the pilot, `no-cli`, TLS optional; (4) web app env: `WEBRTC_STUN_URLS`, `TURN_URLS`, `TURN_SECRET`, `CAMERA_RELAY_FALLBACK`; (5) a pilot matrix (viewer network × cabinet) with columns: time to first frame, `data-ice` candidate type, site uplink used, result; (6) acceptance: at least the agreed share of pilot viewers connect with `host` or `srflx`, the TURN share and its bandwidth are within the cap, and `CAMERA_RELAY_FALLBACK=0` shows the failure message instead of a spinner on a blocked network; (7) rollback: set `CAMERA_RELAY_FALLBACK` unset and force relay by leaving `TURN_*` empty; no data to restore.
- [ ] **Step 2: Scan** `grep -nE '([0-9]{1,3}\.){3}[0-9]{1,3}' docs/ops/webrtc-site-checklist.md`. Expected: no output except documented private-range CIDR lines in the coturn section (review each hit).
- [ ] **Step 3: Commit** `docs(ops): WebRTC site checklist, TURN setup and pilot matrix`.

---

### Task 8: Open the PR

- [ ] **Step 1:** `bun run typecheck`, `bun run lint`, `bun run test` on the branch. Expected: all green.
- [ ] **Step 2: Ask the owner** to approve the push, then push and open the PR against `main`. The PR body states what was and was not verified (no run against a real Pi, a real browser, or a TURN server; go2rtc's `/api/webrtc` format confirmed only if Task 1 step 5.3 was done) and lists the pilot as the real acceptance test.
