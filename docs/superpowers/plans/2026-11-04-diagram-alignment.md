# Diagram Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the dashboard changes that make the web match the hardware diagram (two pumps, no switchable master, honest electrical card) and write the Pi/droplet runbook the owner runs.

**Architecture:** Three small, independent web changes (merge PR #2; lock pump rows in mode OFF; a no-current hint on the electrical card), each with a pure, vitest-tested predicate and thin wiring into existing client components, plus one markdown runbook. No change touches the Pi or the droplet.

**Tech Stack:** Next.js 16.4.3 App Router, React 19, TypeScript, Tailwind 4, vitest 4 (node environment, `src/**/*.test.ts` only: there is no jsdom or React Testing Library).

**Spec:** `docs/superpowers/specs/2026-11-04-diagram-alignment-design.md`

## Global Constraints

- Gates before every commit: `bun run typecheck`, `bun run lint`, `bun run test` (vitest). `bun test` is the wrong runner for this repo.
- Next.js 16 has breaking changes (`AGENTS.md`): the tasks below use only plain React client components and Tailwind classes already in the codebase. Before Task 2 skim `node_modules/next/dist/docs/01-app` for the client-component page to confirm nothing here needs a Next-specific API.
- No internal addresses in the repo (`docs/IDEA.md`): the runbook uses placeholders `<DROPLET_TAILNET_IP>`, `<PI_TAILNET_IP>`, `<DROPLET_PUBLIC_IP>`; no real IP, ssh user or home path.
- No secrets, passwords or tokens in any file or commit message.
- UI copy is Thai and exact: pump lock note `โหมด OFF: สลับเป็นควบคุมเองก่อนจึงสั่งปั๊มได้`; no-current hint `ไม่พบกระแส ทั้งที่ปั๊มทำงาน ตรวจเซ็นเซอร์กระแส`.
- No-current hint hold: 10 s (`NO_CURRENT_HOLD_MS = 10_000`).
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Pushing, merging and deploying need the owner's explicit OK.
- Stale telemetry never looks live: every new UI state must treat `stale` or `null` input as "unknown", never as a confirmed value.

## Review Focus

- Mode `null` or telemetry stale: pump buttons must stay enabled (Task 2 test).
- `pzem.current === null` (PZEM missing): no hint (Task 1 test).
- Pump state `null` (unknown): no hint (Task 1 test).
- Stale telemetry still holding "pump on, 0 A": no hint, because `live` is false (Task 3 prop rule).
- Pump turns off while the hint is showing: the hint disappears at once and re-arms its 10 s hold the next time (Task 3 mounts the hint only while the condition is true).

## File Structure

| File | Responsibility |
|---|---|
| `src/app/dashboard/_components/noCurrent.ts` (new) | `NO_CURRENT_HOLD_MS`, pure `noCurrentWhilePumpOn` |
| `src/app/dashboard/_components/noCurrent.test.ts` (new) | its tests |
| `src/app/dashboard/_components/ElectricCard.tsx` | renders `NoCurrentHint` when the predicate holds and telemetry is live |
| `src/app/dashboard/DashboardClient.tsx` | passes `devices` to `ElectricCard` |
| `src/app/dashboard/_components/modeView.ts` | add pure `pumpsLocked(mode, stale)` next to `modeView` |
| `src/app/dashboard/_components/modeView.test.ts` | its tests |
| `src/app/dashboard/_components/ControlPanel.tsx` | lock the two pump rows with the note when `pumpsLocked` |
| `docs/ops/pi-droplet-alignment.md` (new) | owner runbook |

---

### Task 0: Merge PR #2 and start the work branch (W1)

**Files:** none changed in the repo.

**Interfaces:**
- Produces: `main` containing PR #2; a branch `feat/diagram-alignment` cut from `origin/main` holding the spec and plan commits.

- [ ] **Step 1: Check PR #2 is green.** Run `gh pr view 2 --repo leotawee/water-gate-way --json statusCheckRollup,mergeStateStatus`. Expected: every check `SUCCESS`, `mergeStateStatus` `CLEAN`. Stop if not; fix first.
- [ ] **Step 2: Ask the owner to confirm the merge.** Merging deploys to production through `ci.yml` (`release` and `deploy` run only on `main`). Do not merge without a yes in chat.
- [ ] **Step 3: Merge.** `gh pr merge 2 --repo leotawee/water-gate-way --merge`.
- [ ] **Step 4: Verify the deploy (read-only).** Over ssh to the droplet: `last-deployed` equals `sha-<merge sha>`; `docker ps` shows `wgw-web-app-1` `(healthy)`; `docker logs --since 5m wgw-web-app-1 | grep -ciE "invalid command-line|FATAL"` prints `0`; `curl -s -o /dev/null -w '%{http_code}' https://www.hyxc.io/login` prints `200`. If the container lacks compose labels or `ro=false`, someone recreated it by hand: stop and report (a hand-made container with the quoted `PGOPTIONS` broke the site on 2026-11-04).
- [ ] **Step 5: Create the work branch.** `git fetch origin && git switch -c feat/diagram-alignment origin/main && git cherry-pick 49375a4` (the spec commit), then cherry-pick the commit that adds this plan file.

---

### Task 1: `noCurrentWhilePumpOn` predicate (W3, logic)

**Files:**
- Create: `src/app/dashboard/_components/noCurrent.ts`
- Test: `src/app/dashboard/_components/noCurrent.test.ts`

**Interfaces:**
- Consumes: `GateStatus` from `@/lib/telemetry/parseStatus` (`devices.pump`, `devices.relay1`, `pzem.current`).
- Produces:
  - `export const NO_CURRENT_HOLD_MS = 10_000`
  - `export function noCurrentWhilePumpOn(devices: GateStatus["devices"] | null, pzem: GateStatus["pzem"] | null): boolean`

- [ ] **Step 1: Write the failing test** in `noCurrent.test.ts`. Build inputs with two local helpers, `dev(o)` returning a full `devices` object (`pump`, `alarm`, `light`, `relay1`, `relay2`, `master1` all `null`, overridden by `o`) and `pz(current)` returning `{ voltage: 224, current, frequency: 50, power: 0 }`. Cases, each one `it`:
  - pump `true`, current `0` → `true`
  - relay1 `true` (pump 2), current `0` → `true`
  - pump `true`, current `1.2` → `false`
  - pump `false`, relay1 `false`, current `0` → `false`
  - pump `true`, current `null` → `false`
  - pump `null`, relay1 `null`, current `0` → `false`
  - `devices` `null` or `pzem` `null` → `false`
- [ ] **Step 2: Run** `bun run test src/app/dashboard/_components/noCurrent.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** `noCurrentWhilePumpOn` in `noCurrent.ts`: true only when (`devices.pump === true` or `devices.relay1 === true`) and `pzem.current === 0` (strict, so `null` is false). Export `NO_CURRENT_HOLD_MS`.
- [ ] **Step 4: Run** the same command. Expected: PASS, 7 tests.
- [ ] **Step 5: Commit** `noCurrent.ts` and `noCurrent.test.ts` with message `feat(dashboard): predicate for zero current while a pump relay is on`.

---

### Task 2: Lock the pump rows in mode OFF (W2)

**Files:**
- Modify: `src/app/dashboard/_components/modeView.ts`, `src/app/dashboard/_components/ControlPanel.tsx` (the `rows.map` block and a new constant near `rows`)
- Test: `src/app/dashboard/_components/modeView.test.ts`

**Interfaces:**
- Consumes: `GateMode` (`"AUTO" | "MANUAL" | "OFF"`) from `parseStatus`; `DeviceSwitch` props `readOnly` and `note` (already exist in `src/components/DeviceSwitch.tsx`).
- Produces: `export function pumpsLocked(mode: GateMode | null, stale: boolean): boolean`

- [ ] **Step 1: Write the failing tests** appended to `modeView.test.ts` in a `describe("pumpsLocked")`: `("OFF", false)` → `true`; `("OFF", true)` → `false`; `("MANUAL", false)` → `false`; `("AUTO", false)` → `false`; `(null, false)` → `false`; `(null, true)` → `false`.
- [ ] **Step 2: Run** `bun run test src/app/dashboard/_components/modeView.test.ts`. Expected: FAIL (`pumpsLocked` is not exported).
- [ ] **Step 3: Implement** `pumpsLocked` in `modeView.ts`: `mode === "OFF" && !stale`, with a one-line WHY comment (firmware does not accept `R1` in OFF; the Pi's local dashboard only allows pump commands in MANUAL).
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Wire `ControlPanel.tsx`.** Compute `const locked = pumpsLocked(mode, stale);` next to `master`. In the `rows.map`, for rows whose `key` is `"pump"` or `"relay1"` pass `readOnly={readOnly || locked}` and `note={locked ? "โหมด OFF: สลับเป็นควบคุมเองก่อนจึงสั่งปั๊มได้" : undefined}`; the alarm row keeps `readOnly={readOnly}` and no note. Add the import from `./modeView`.
- [ ] **Step 6: Gates.** `bun run typecheck`, `bun run lint`, `bun run test`. Expected: zero errors, all tests pass.
- [ ] **Step 7: Commit** with message `feat(dashboard): lock the pump rows while the controller is in mode OFF`.

---

### Task 3: No-current hint on the electrical card (W3, UI)

**Files:**
- Modify: `src/app/dashboard/_components/ElectricCard.tsx` (props and a local `NoCurrentHint`), `src/app/dashboard/DashboardClient.tsx` (the `<ElectricCard … />` call, near line 183)

**Interfaces:**
- Consumes: `noCurrentWhilePumpOn`, `NO_CURRENT_HOLD_MS` from Task 1; `status?.devices` from `DashboardClient`.
- Produces: `ElectricCard` props become `{ pzem: GateStatus["pzem"] | null; devices: GateStatus["devices"] | null; live: boolean }`.

- [ ] **Step 1: Pass the prop.** In `DashboardClient.tsx` change the call to `<ElectricCard pzem={status?.pzem ?? null} devices={status?.devices ?? null} live={live} />`.
- [ ] **Step 2: Add `NoCurrentHint`** inside `ElectricCard.tsx`: a function component with `useState(false)` and a `useEffect` that sets a `setTimeout(() => setShown(true), NO_CURRENT_HOLD_MS)` and clears it on cleanup; it renders the exact hint copy as a `<p>` styled like the card's other secondary text (`text-sm`, `text-warn`) when `shown`, otherwise `null`. WHY comment: the component is mounted only while the condition holds, so unmounting resets the hold and no synchronous `setState` runs inside the effect (the React purity lint flags that).
- [ ] **Step 3: Render it.** In `ElectricCard`, below the phase table, render `<NoCurrentHint />` only when `live && noCurrentWhilePumpOn(devices, pzem)`.
- [ ] **Step 4: Gates.** `bun run typecheck`, `bun run lint`, `bun run test`. Expected: all green (no new test: the hold lives in a timer and the repo has no DOM test environment; the predicate is covered by Task 1).
- [ ] **Step 5: Commit** with message `feat(dashboard): hint when a pump relay is on but the meter reads no current`.
- [ ] **Step 6: Manual check (owner, after deploy).** With a person at the site, switch a pump on in MANUAL. Expected: the hint appears about 10 s after the pump relay reports on while current stays `0.00`, and disappears when the pump is switched off. If a local dev server cannot reach MQTT and Postgres, this check is the only visual verification.

---

### Task 4: Ops runbook (O1)

**Files:**
- Create: `docs/ops/pi-droplet-alignment.md`

**Interfaces:**
- Consumes: `docs/superpowers/plans/2026-10-30-broker-lockdown.md` (earlier lockdown plan, written before the hosts moved tailnets; it still mentions an nginx `/mqtt` route and old tailnet IPs).
- Produces: a document only. No command in it is run by this work.

- [ ] **Step 1: Write the runbook** with these sections, in this order, using the placeholders from Global Constraints: (1) purpose and status line ("nothing here has been executed"), (2) what changed since the 2026-10-30 lockdown plan (hosts are on the owner's tailnet; web traffic reaches the app through a Cloudflare tunnel, so the old nginx `/mqtt` route is gone; `docker compose` now runs the web container), (3) backup of the broker config, `passwd`, `acl` and the Pi unit files, (4) move `webrtc_bridge` off the public `:9001` to the tailnet address with credentials, (5) read `/etc/mosquitto/acl` and confirm accounts: `nextjs` (publish `stm32/cmd`; read `stm32/status/all` and `water/gate/person`) and the Pi nodes, (6) apply `secure.conf.staged`, (7) rotate the `nextjs` password in `passwd`, in `app.env`, and in the Pi units' `MQTT_PASS`, (8) verify from outside the tailnet that a credential-less MQTT CONNECT is refused or times out, and that web control, status stream and all six Pi nodes work, (9) `systemctl disable --now water_gateway`, (10) the decision about the two writers of `stm32/cmd/raw` (`cmd_node` vs `dashboard_tx_node`), stated as the owner's call with the collision risk, (11) the physical current check with a clamp meter, (12) rollback for steps 4-7. Each step has the exact command, the expected result, and who runs it (`sudo` steps are the owner's).
- [ ] **Step 2: Add the ordering rule** at the top of the broker steps, copied from `docs/IDEA.md`: never close the old broker listeners before the Pi nodes and `webrtc_bridge` use tailnet addresses with credentials.
- [ ] **Step 3: Scan for leaks.** Run `grep -nE '([0-9]{1,3}\.){3}[0-9]{1,3}' docs/ops/pi-droplet-alignment.md`. Expected: no output.
- [ ] **Step 4: Commit** with message `docs(ops): runbook to align the Pi and droplet with the diagram`.

---

### Task 5: Open the PR

**Files:** none.

- [ ] **Step 1: Final gates on the branch.** `bun run typecheck`, `bun run lint`, `bun run test`. Expected: all green.
- [ ] **Step 2: Ask the owner to approve the push**, then `git push -u origin feat/diagram-alignment` and `gh pr create --repo leotawee/water-gate-way --base main --head feat/diagram-alignment`. The PR body states what was and was not verified (hardware acceptance of `R1` in MANUAL and the live hint are owner checks after deploy). No "Generated with" line in the body.
