# Multi-cabinet foundation (phases P0-P2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make telemetry, commands, audit rows, water-level history and the dashboard per cabinet (`gate-N`), keep `gate-1` working unchanged during the move, and give the owner a topic contract and ACL generator for the broker.

**Architecture:** The server derives the gate id from the MQTT topic (never the payload), keeps per-gate state in the telemetry broker module, and addresses commands to `gate/<id>/cmd`. `gate-1` keeps its legacy topics (`stm32/status/all`, `water/gate/person`, `stm32/cmd`) until the hardware team switches the Pi; both old and new topics are accepted meanwhile. Water-level rows reuse the existing `device_id` column as the gate id.

**Tech Stack:** Next.js 16.4.3 App Router, React 19, TypeScript, mqtt 5, pg 8, vitest 4 (node environment, `src/**/*.test.ts`, no DOM).

**Spec:** `docs/superpowers/specs/2026-11-04-multi-cabinet-webrtc-design.md` (sections 1, 2, 5; phases P0-P2). Video (P3) and the provisioning installer and enrollment screen (P4) are out of this plan.

## Global Constraints

- Gates before every commit: `bun run typecheck`, `bun run lint`, `bun run test` (vitest; `bun test` is the wrong runner).
- Next.js 16 has breaking changes (`AGENTS.md`): before Task 3 skim `node_modules/next/dist/docs/01-app` for route handlers and `searchParams`; the tasks use only APIs already present in this repo.
- Gate id format is exactly `^gate-[0-9]{1,4}$`. The gate id comes from the topic or the validated request parameter, never from a message payload.
- Topic names (exact): `gate/<id>/status`, `gate/<id>/person`, `gate/<id>/cmd`; legacy: `stm32/status/all`, `water/gate/person`, `stm32/cmd`, all belonging to `gate-1`.
- QoS 0 for commands, no queueing while offline (`queueQoSZero: false` stays).
- A command for one gate must never be published to another gate's topic.
- Additive migrations only; no `drop`, `delete`, `truncate`, or destructive `update` outside the single documented backfill. Nothing runs against production without the owner's explicit OK.
- No internal addresses, passwords or tokens in the repo or in commit messages.
- Do not enable per-gate ACLs on the production broker before the P0 runbook (`docs/ops/pi-droplet-alignment.md`) is done and the Pi nodes publish the new topics.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Pushing, merging and deploying need the owner's OK.
- Start state: this spec and plan are untracked files in the checkout that wrote them, and that checkout had uncommitted edits by another session in `ControlPanel.tsx` and `DashboardClient.tsx`. Cut the work branch from `origin/main` (for example `feat/multi-cabinet-p0-p2`), add only the spec and plan files in a first docs commit, never use `git stash` or `git add -A`, and re-read `ControlPanel.tsx` and `DashboardClient.tsx` before editing them.

## Review Focus

- A message on `gate/gate-2/status` whose payload names another gate is attributed to `gate-2` only (Task 3 test).
- Hostile or malformed topics (`gate/gate-1/status/extra`, `gate/GATE-1/status`, `gate/../status`, `gate/+/status`) produce no gate (Task 1 tests).
- `?gate=` that is malformed, unknown or inactive returns 400 or 404 and never data from another gate (Tasks 3, 5, 6 tests).
- A command for `gate-2` is never published to `gate-1`'s topic or to the legacy topic; a gate with `has_device = false` rejects commands (Task 5 tests).
- `gate-1` receiving the same status on both the legacy and the new topic (dual-publish) records one water-level row per sample window, not two (Task 2 test).

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/gates.ts` | add `GATE_ID_RE`, `isGateId` (client-safe) |
| `src/lib/telemetry/topics.ts` (new) | topic constants, `parseTelemetryTopic`, `commandTopicFor` |
| `src/lib/telemetry/recordLevel.ts` | per-gate sampling, `device_id` = gate id |
| `src/lib/telemetry/broker.ts` | per-gate last status and person count, per-gate listeners |
| `src/app/api/status/stream/route.ts` | `?gate=` parameter |
| `db/migrations/004_multi_gate.sql` (new) | additive columns, index, documented backfill |
| `src/lib/control/forward.ts`, `src/app/api/control/route.ts` | per-gate command and audit |
| `src/hooks/useGateStatus.ts`, `src/app/dashboard/DashboardClient.tsx`, `ControlPanel.tsx`, `WaterLevelChart.tsx` | pass the gate id |
| `src/app/api/water-level/route.ts`, `.../download/route.ts` | filter by gate |
| `src/lib/broker/acl.ts` (new), `scripts/render-acl.ts` (new) | pure ACL renderer and CLI |
| `docs/ops/gate-topic-contract.md` (new) | what the Pi nodes must do |

---

### Task 1: Gate id and topic parsing

**Files:**
- Modify: `src/lib/gates.ts`, `src/lib/gatesDb.ts` (use `GATE_ID_RE`), `src/app/admin/actions.ts` (use `GATE_ID_RE`)
- Create: `src/lib/telemetry/topics.ts`
- Test: `src/lib/gates.test.ts`, `src/lib/telemetry/topics.test.ts` (new)

**Interfaces:**
- Produces:
  - `export const GATE_ID_RE: RegExp` (`/^gate-[0-9]{1,4}$/`) and `export function isGateId(v: unknown): v is string` in `src/lib/gates.ts`
  - in `topics.ts`: `export const LEGACY_GATE = "gate-1"`, `LEGACY_STATUS_TOPIC = "stm32/status/all"`, `LEGACY_PERSON_TOPIC = "water/gate/person"`, `LEGACY_CMD_TOPIC = "stm32/cmd"`, `STATUS_FILTER = "gate/+/status"`, `PERSON_FILTER = "gate/+/person"`
  - `export type TopicKind = "status" | "person"`
  - `export function parseTelemetryTopic(topic: string): { gateId: string; kind: TopicKind } | null`
  - `export function commandTopicFor(gateId: string, legacy: boolean): string` (legacy topic only when `legacy` is true and `gateId === LEGACY_GATE`; otherwise `gate/<id>/cmd`)

- [ ] **Step 1: Write the failing tests.** In `gates.test.ts`: `isGateId` is true for `"gate-1"`, `"gate-1234"`; false for `"gate-0a"`, `"gate-12345"`, `"GATE-1"`, `"gate-"`, `""`, `42`, `null`. In `topics.test.ts`: `parseTelemetryTopic("stm32/status/all")` → `{gateId: "gate-1", kind: "status"}`; `("water/gate/person")` → `{gateId: "gate-1", kind: "person"}`; `("gate/gate-2/status")` → `{gateId: "gate-2", kind: "status"}`; `("gate/gate-2/person")` → `{gateId: "gate-2", kind: "person"}`; each of `gate/gate-1/status/extra`, `gate/GATE-1/status`, `gate/../status`, `gate/+/status`, `gate/gate-1/cmd`, `gate/gate-1/`, `stm32/cmd`, `""` → `null`. `commandTopicFor("gate-1", true)` → `"stm32/cmd"`; `("gate-1", false)` → `"gate/gate-1/cmd"`; `("gate-2", true)` → `"gate/gate-2/cmd"`.
- [ ] **Step 2: Run** `bun run test src/lib/gates.test.ts src/lib/telemetry/topics.test.ts`. Expected: FAIL (exports missing).
- [ ] **Step 3: Implement** the exports above. `parseTelemetryTopic` splits on `/` and accepts only the four shapes in the test list, validating the id with `isGateId`. Replace the local `GATE_ID` regexes in `gatesDb.ts` and `admin/actions.ts` with `GATE_ID_RE`.
- [ ] **Step 4: Run** the same command plus `bun run test`. Expected: PASS, no other test changes.
- [ ] **Step 5: Commit** `feat(gates): gate id check and telemetry topic parser`.

---

### Task 2: Per-gate water-level recording

**Files:**
- Modify: `src/lib/telemetry/recordLevel.ts`, `src/lib/telemetry/broker.ts` (the single call site, passing `LEGACY_GATE` for now)
- Test: `src/lib/telemetry/recordLevel.test.ts`

**Interfaces:**
- Consumes: `LEGACY_GATE` from Task 1.
- Produces:
  - `createLevelRecorder(insert: (gateId: string, liquid: number, at: Date) => Promise<unknown>, sampleMs: number): (status: GateStatus, gateId: string) => Promise<void>` (one sample window **per gate**)
  - `export const recordLevel: (status: GateStatus, gateId: string) => Promise<void>`; the real insert writes `device_id = gateId` (no longer the constant `'stm32-radar'`)

- [ ] **Step 1: Write the failing tests** in `recordLevel.test.ts`, keeping the existing cases adapted to the new signature, plus: (a) two statuses for `gate-1` inside one window insert once (the dual-publish duplicate case); (b) one status each for `gate-1` and `gate-2` at the same instant insert twice, with the gate id passed to `insert`; (c) a failed insert for `gate-2` does not block `gate-1`.
- [ ] **Step 2: Run** `bun run test src/lib/telemetry/recordLevel.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the signatures above: replace the single `lastAt` with a `Map<string, number>` keyed by gate id; build the real insert with `device_id = $1`. In `broker.ts` pass `LEGACY_GATE` to `recordLevel(status, LEGACY_GATE)`.
- [ ] **Step 4: Run** `bun run test`, `bun run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(telemetry): record water level per gate`.

---

### Task 3: Per-gate broker state and status stream

**Files:**
- Modify: `src/lib/telemetry/broker.ts`, `src/app/api/status/stream/route.ts`
- Test: `src/lib/telemetry/stream.test.ts`

**Interfaces:**
- Consumes: `parseTelemetryTopic`, `STATUS_FILTER`, `PERSON_FILTER`, `LEGACY_*` from Task 1; `recordLevel(status, gateId)` from Task 2; `isGateId`, `getGate` (`src/lib/gatesDb.ts`).
- Produces:
  - `subscribeStatus(gateId: string, listener: Listener): () => void` (the listener gets the current connection state and that gate's last status immediately, then live events for that gate; connection events go to every listener)
  - the stream route accepts `GET /api/status/stream?gate=<id>`; missing `gate` means `gate-1`; a value failing `isGateId` returns 400 `{ error: "invalid_gate" }`; an id with no active gate (`getGate` null) returns 404 `{ error: "unknown_gate" }`; `HEAD` is unchanged.

- [ ] **Step 1: Write the failing tests** in `stream.test.ts`, updating existing calls to `subscribeStatus("gate-1", …)` and adding:
  - subscribes to exactly the legacy status, legacy person, `gate/+/status`, `gate/+/person` topics, plus `MQTT_TOPIC_STATUS` when it differs from the legacy status topic;
  - a message on `gate/gate-2/status` reaches only the `gate-2` listener, with `recordLevel` called with `(status, "gate-2")`;
  - a `gate/gate-2/status` payload containing `"gate": "gate-1"` still reaches only `gate-2`;
  - a message on a topic that `parseTelemetryTopic` rejects emits nothing and logs at most one warning;
  - a `gate/gate-2/person` count merges only into `gate-2`'s last status;
  - the legacy topics keep working for `gate-1`;
  - route: `?gate=gate-1` and no parameter stream `gate-1`; `?gate=x` returns 400; a gate that `getGate` returns null for returns 404 (mock `@/lib/gatesDb`).
- [ ] **Step 2: Run** `bun run test src/lib/telemetry/stream.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `State`: `last: Map<string, GateStatus>`, `person: Map<string, { n: number; at: number }>`, `listeners: Map<string, Set<Listener>>`; connection state stays single. In the message handler, take `{gateId, kind}` from `parseTelemetryTopic(topic)`; extra `MQTT_TOPIC_STATUS` maps to `LEGACY_GATE` as a status topic. Keep the freshness rules (a person message never changes `receivedAt`; a person count older than 30 s is not merged). In the route, parse `new URL(request.url).searchParams.get("gate")`.
- [ ] **Step 4: Run** `bun run test`, `bun run typecheck`, `bun run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(telemetry): per-gate status state and ?gate= stream`.

---

### Task 4: Migration 004

**Files:**
- Create: `db/migrations/004_multi_gate.sql`
- Test: `src/lib/migration004.test.ts` (same pattern as `src/lib/migration002.test.ts`)

**Interfaces:**
- Produces (SQL): `gates` gains `media_base_url text`, `cameras text[] not null default '{}'`, `enrolled_at timestamptz`, `last_seen_at timestamptz`; `control_audit` gains `gate_id text`; index `water_levels_device_time_idx on water_levels (device_id, measured_at)`; a commented one-statement backfill `update water_levels set device_id = 'gate-1' where device_id = 'stm32-radar'` that the owner runs deliberately, not as part of the file's executable body.

- [ ] **Step 1: Write the failing test** `migration004.test.ts`: reads the SQL (lower-cased); it never contains `drop`, `truncate`, `delete from`; every `alter table` line uses `add column if not exists`; contains `create index if not exists water_levels_device_time_idx`; the backfill statement appears only inside a `--` comment line.
- [ ] **Step 2: Run** `bun run test src/lib/migration004.test.ts`. Expected: FAIL (file missing).
- [ ] **Step 3: Write** the migration with the objects above, all idempotent, with a header comment stating the deploy order from this plan (apply the migration, then deploy the code, then run the backfill once and again after the old image has stopped writing).
- [ ] **Step 4: Run** `bun run test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(db): additive migration for multi-gate`. **Do not apply it to any database in this plan; the owner applies it.** Record in the PR that Task 5 and Task 6 code needs it applied first (`control_audit.gate_id`).

---

### Task 5: Per-gate commands and audit

**Files:**
- Modify: `src/lib/control/forward.ts`, `src/app/api/control/route.ts`
- Test: `src/lib/control/forward.test.ts`, `src/app/api/control/route.test.ts` (new)

**Interfaces:**
- Consumes: `commandTopicFor`, `LEGACY_GATE` (Task 1), `isGateId`, `getGate` (`gatesDb`).
- Produces:
  - `forwardCommand(gateId: string, cmd: Command): Promise<"sent" | "failed">`; it publishes to `commandTopicFor(gateId, process.env.WGW_LEGACY_TOPICS !== "0")`
  - `POST /api/control` body `{ command, gate? }`; missing `gate` means `gate-1`; invalid id → 400 `invalid_gate`; no active gate → 404 `unknown_gate`; gate with `hasDevice === false` → 409 `no_device`; every outcome after auth still writes one `control_audit` row, now including `gate_id`.

- [ ] **Step 1: Write the failing tests.** `forward.test.ts`: `forwardCommand("gate-1", "R1")` publishes to `stm32/cmd` while `WGW_LEGACY_TOPICS` is unset and to `gate/gate-1/cmd` when it is `"0"`; `forwardCommand("gate-2", "R1")` publishes to `gate/gate-2/cmd` in both cases and never to `stm32/cmd`. `route.test.ts` (mock `@/lib/db`, `@/lib/auth/dal`, `@/lib/auth/rateLimit`, `@/lib/control/forward`, `@/lib/gatesDb`, `@/lib/http/sameOrigin`): the audit insert receives the gate id; `gate: "gate-2"` calls `forwardCommand("gate-2", …)`; `gate: "x"` → 400 and no forward; unknown gate → 404 and no forward; `hasDevice: false` → 409 and no forward; omitted `gate` forwards to `gate-1`; the existing 400/403/429/502 behaviours still hold.
- [ ] **Step 2: Run** `bun run test src/lib/control src/app/api/control`. Expected: FAIL.
- [ ] **Step 3: Implement** the signatures above; extend `AUDIT_SQL` with the `gate_id` column and thread `gateId` through `audit`. Rejected-command rows record the gate id when it is valid, `null` otherwise.
- [ ] **Step 4: Run** `bun run test`, `bun run typecheck`, `bun run lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(control): address commands and audit rows per gate`.

---

### Task 6: Dashboard and water-level per gate

**Files:**
- Modify: `src/hooks/useGateStatus.ts`, `src/app/dashboard/DashboardClient.tsx`, `src/app/dashboard/_components/ControlPanel.tsx`, `src/app/dashboard/_components/WaterLevelChart.tsx`, `src/app/api/water-level/route.ts`, `src/app/api/water-level/download/route.ts`
- Test: `src/app/api/water-level/route.test.ts` (new)

**Interfaces:**
- Consumes: `isGateId` (Task 1); the stream and control contracts from Tasks 3 and 5.
- Produces:
  - `useGateStatus(gateId: string): { status: GateStatus | null; conn: GateConn }` (opens `/api/status/stream?gate=<encoded id>`; the HEAD probe uses the same URL)
  - `ControlPanel` and `WaterLevelChart` take a `gateId: string` prop; `ControlPanel`'s POST body becomes `{ command, gate: gateId }`; the chart calls `/api/water-level?gate=<id>` and links `/api/water-level/download?gate=<id>`
  - `GET /api/water-level` and `GET /api/water-level/download` read `?gate=` (default `gate-1`), reject an invalid id with 400 `{ error: "invalid_gate" }`, and add `where device_id = $1` to their queries.

- [ ] **Step 1: Write the failing tests** in `route.test.ts` (mock `@/lib/db`, `@/lib/auth/dal`): default gate queries with parameter `"gate-1"`; `?gate=gate-2` passes `"gate-2"`; `?gate=x` returns 400 and never queries; the 401 and 503 paths are unchanged; the download route's query also takes the gate parameter.
- [ ] **Step 2: Run** `bun run test src/app/api/water-level`. Expected: FAIL.
- [ ] **Step 3: Implement** the signatures above; in `DashboardClient`, pass `gate.id` to `useGateStatus`, `ControlPanel` and `WaterLevelChart`. Keep the readings layout unchanged.
- [ ] **Step 4: Run** `bun run test`, `bun run typecheck`, `bun run lint`. Expected: PASS.
- [ ] **Step 5: Manual check (owner, after the migration and deploy):** open `/dashboard?gate=gate-1` and confirm live data, a command round-trip, and the chart; a nonexistent gate shows the 404 page.
- [ ] **Step 6: Commit** `feat(dashboard): per-gate stream, commands and water-level history`.

---

### Task 7: ACL renderer and topic contract

**Files:**
- Create: `src/lib/broker/acl.ts`, `scripts/render-acl.ts`, `docs/ops/gate-topic-contract.md`
- Test: `src/lib/broker/acl.test.ts`

**Interfaces:**
- Consumes: `isGateId` (Task 1).
- Produces: `export function renderAcl(gateIds: string[], serverUser?: string): string` returning Mosquitto ACL text: for `serverUser` (default `nextjs`) `topic read gate/+/status`, `topic read gate/+/person`, `topic write gate/+/cmd`, plus the legacy equivalents (`stm32/status/all`, `water/gate/person` read; `stm32/cmd` write); for each valid gate id a `user <id>` block with `topic write gate/<id>/status`, `topic write gate/<id>/person`, `topic read gate/<id>/cmd`; throws on an invalid id. `scripts/render-acl.ts` prints `renderAcl(process.argv.slice(2))`.

- [ ] **Step 1: Write the failing tests:** output for `["gate-1", "gate-2"]` contains each gate's own three lines; `gate-1`'s block contains no line mentioning `gate-2`; no gate user line grants `readwrite`, `#` or `+`; output for `["gate-1", "bad id"]` throws; the server block has no `topic write` on any `status` or `person` topic.
- [ ] **Step 2: Run** `bun run test src/lib/broker`. Expected: FAIL.
- [ ] **Step 3: Implement** `renderAcl` and the script.
- [ ] **Step 4: Write `docs/ops/gate-topic-contract.md`** (no addresses, no credentials): the topic table with payload formats (status JSON as today's `stm32/status/all`; person `{ "person_count": n }`; command a bare two-character or mode string); the `TOPIC_PREFIX` environment variable each Pi service must honour (`gate/<id>`); the dual-publish period for `gate-1` and how to end it (set `WGW_LEGACY_TOPICS=0` on the web app once the Pi publishes and subscribes the new topics, then remove the legacy topics); how to generate the ACL with `bun run scripts/render-acl.ts gate-1 gate-2`; and a pointer to `docs/ops/pi-droplet-alignment.md` for applying it. State plainly that the Pi code is the hardware team's.
- [ ] **Step 5: Scan** `grep -nE '([0-9]{1,3}\.){3}[0-9]{1,3}' docs/ops/gate-topic-contract.md src/lib/broker/acl.ts`. Expected: no output.
- [ ] **Step 6: Run** `bun run test`, `bun run typecheck`, `bun run lint`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(ops): per-gate broker ACL renderer and topic contract`.

---

### Task 8: Open the PR

- [ ] **Step 1: Final gates** on the branch: `bun run typecheck`, `bun run lint`, `bun run test`. Expected: all green.
- [ ] **Step 2: Ask the owner** to approve the push, then push and open the PR against `main`. The PR body lists the deploy order (migration 004 → deploy → backfill, run by the owner), the hardware-team dependency (Pi nodes must honour `TOPIC_PREFIX`), that nothing was applied to production, and what was not verified (no run against a real broker or real second cabinet).
