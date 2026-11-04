# Align the system with the hardware diagram + zero-current root cause

Date: 2026-11-04 · Status: draft for owner review · Scope: web repo + a written ops runbook (no changes to the Pi or droplet from this work)

## Intent

The owner wants the running system to match `docs/diagram/1.drawio` (two pumps, one alarm/LED-tower/light output, three floats, two wire-break inputs, PZEM and radar over RS485, three cameras; no master relay control) and wants to know why the electrical current never shows on the dashboard.

Success looks like:
- The dashboard controls exactly what the diagram says it can: PUMP1, PUMP2, the alarm output, and the controller mode. Nothing else can be switched from the web.
- The cause of "current always 0.00 A" is stated with evidence, and the web does not hide it.
- The Pi/droplet changes that need `sudo` are written down as an ordered runbook the owner runs. This work does not touch those machines.

## Verified findings (2026-11-04, read-only, via SSH to the Pi and droplet)

| Finding | Evidence |
|---|---|
| Current, power and energy are zero at the source | 7,202 retained raw status frames (Pi `stm32-status-node` journal, 14:03–18:03): 0 frames with non-zero bytes in `[6:12]`, `[12:24]` or `[24:36]`. Re-checked independently of the first count. Trace logs back to 2026-11-03 18:06 also show `i`, `p`, `e` = 0 (reported by the investigating subagent; not re-checked). |
| The Pi decoder is not the cause | `shared/protocol.py` `parse_status_payload` offsets match the data; frequency decodes correctly (49.89 Hz); no PZEM/Modbus/RS485/CRC errors in the journals. |
| Zero holds even when a pump relay bit is set | 2,971 frames have the PUMP1 (0x04) or PUMP2 (0x08) bit set; none has non-zero I/P/E. The relay bit is the STM32's recorded state, not contactor feedback. |
| Energy has been zero for days | A PZEM accumulates kWh once any load passes its sensor. |
| Master relays follow the mode, not the web | `Q0` reached the UART (`aa550301000103`) but `pc2` stayed set; `P0`/`R0` cleared `pc0`/`pc1`. In mode OFF all four `pc0..pc3` go false. |
| `R1` in mode OFF is not accepted | Frame `aa550308000209` reached the UART; `pc1` did not change; UI timed out with "device not confirmed". `R1` in MANUAL is **untested**. |
| Pump 2 is `pc1` / `R1,R0` | `shared/protocol.py` `DASH_COMMANDS` and the local Pi dashboard ("Pump 2" = `pc1`). `pc2` is MASTER2 and `pc3` is MASTER1. |
| The public broker accepts anonymous clients | A credential-less MQTT CONNECT to `178.128.49.254:1883` from the owner's Mac returned CONNACK 0. Ports 1883, 9001, 8883 are reachable. |
| Only one process owns the UART | `serial_bridge` (pid 996) holds `/dev/ttyAMA0`. `cmd_node` and `dashboard_tx_node` both publish `stm32/cmd/raw`. |
| The AI person detector is not running anywhere | No `wgw-detect` unit, no detector process on the Pi; no `ai-receiver` process on the droplet. `water/gate/person` is never published. |

Unresolved (cannot be told apart from the Pi): the current sensor is not on the pump circuit or is unwired; the STM32 firmware does not read the current/energy registers; or the pumps do not actually run. A clamp meter on the pump line with the pump relay on separates the first two from the third.

## Scope

In:
1. Merge PR #2 (two pumps named "ปั๊ม 1" / "ปั๊ม 2", master relay read-only, `Q/M` commands removed from the web allowlist, `pc3` parsed).
2. Web: disable the pump rows in mode OFF with a stated reason.
3. Web: a no-current hint on the electrical card.
4. A runbook in `docs/ops/` for the Pi/droplet work.

Out: STM32 firmware, PZEM/CT wiring, the ESP32 touch screen, battery telemetry (the diagram shows a battery; no data reaches the web), a separate Light control (the diagram puts Light, Alarm and LED Tower on one relay output; `cmd_node` replies "Light not supported"), and bringing up `wgw-detect` (needs the owner's camera `.env`).

## Design

### W1. Merge PR #2
No new design. Acceptance: CI green, then merge to `main`; the deploy runs from `main` (`.github/workflows/ci.yml` jobs `release` and `deploy`).

### W2. Pump rows disabled in mode OFF
- When the reported mode is `OFF` and telemetry is not stale, the "ปั๊ม 1" and "ปั๊ม 2" rows render their state but no command buttons, with the note "โหมด OFF: สลับเป็นควบคุมเองก่อนจึงสั่งปั๊มได้".
- Basis: the Pi's local dashboard only allows pump commands in MANUAL with both masters ON (`dashboard_tx_node.py`), and `R1` in OFF is not accepted by the firmware. `P1` in OFF was not tested; it is disabled for consistency with the local rule.
- Unknown or stale mode: buttons stay enabled (the server stays authoritative, as today).
- The alarm row and the mode selector are unchanged.
- Reuse `DeviceSwitch`'s existing `readOnly` and `note` props; no new component.

### W3. No-current hint
- A pure function `noCurrentWhilePumpOn(devices, pzem)` returns true when `devices.pump === true || devices.relay1 === true` and `pzem.current === 0` (not null).
- The electrical card shows "ไม่พบกระแส ทั้งที่ปั๊มทำงาน ตรวจเซ็นเซอร์กระแส" only after the condition has held for 10 s (a `useRef` timestamp in the client component), so the 2 s telemetry lag after a switch-on does not flash it.
- Not shown when stale, when `current` is null, or when no pump is on. The value shown stays the real reading (0.00 A); the hint adds a reason, it does not replace the number.

### W4. Master relay row
Kept as the existing read-only "Master relay" row (pc2 AND pc3). It is not in the diagram but is useful when diagnosing the mode-tied behaviour. The owner can ask to drop it.

### O1. Ops runbook (`docs/ops/pi-droplet-alignment.md`)
A document, not automation. Ordered steps, each with the exact command, the expected result, and a rollback; the owner runs everything that needs `sudo`:
1. Record the current state (broker conf, `passwd`, `acl`, unit files) as a backup.
2. Move `webrtc_bridge` off the public IP `178.128.49.254:9001` onto the tailnet address with credentials.
3. Read `/etc/mosquitto/acl` and confirm the accounts: `nextjs` (publish `stm32/cmd`, read `stm32/status/all`, `water/gate/person`) and the Pi nodes; fix the ACL before enabling it.
4. Apply `secure.conf.staged` (listeners bound to loopback and the tailnet address, `allow_anonymous false`, password file, ACL).
5. Rotate the `nextjs` password in `/etc/mosquitto/passwd`, `app.env` and the Pi units' `MQTT_PASS`.
6. Verify from outside: the same credential-less CONNECT must now be refused or time out; web control and status still work; all six Pi nodes reconnect.
7. `systemctl disable --now water_gateway` (its venv path no longer exists; 757 restarts).
8. Pick one writer of `stm32/cmd/raw`. Recommendation: keep `cmd_node` (the web path) and stop `dashboard_tx_node` only if the owner confirms the local Pi dashboard is unused; otherwise leave both and record the collision risk. This step is a decision for the owner, not a default.
9. A checklist for the physical current check (clamp meter, pump relay on, compare with the PZEM reading).

Ordering constraint (from `docs/IDEA.md`): never close the broker ports before the Pi nodes and `webrtc_bridge` are on tailnet addresses with credentials, or the Pi loses the ability to command the pumps.

## Testing

- W2: unit test the "pump rows disabled" predicate (mode OFF + fresh → disabled; OFF + stale → enabled; MANUAL/AUTO/null → enabled).
- W3: unit tests for `noCurrentWhilePumpOn` (pump on + 0 → true; pump on + 1.2 → false; pump off + 0 → false; current null → false) and for the 10 s hold.
- `bun run typecheck`, `bun run lint`, `bun run test` (vitest) stay green.
- Hardware acceptance, by the owner with someone at the site: in MANUAL, `R1` then `R0` from the dashboard changes `pc1` and the pump physically responds. This is the one thing the evidence cannot settle.

## Risks

- Broker lockdown can cut the Pi's command path; mitigated by the ordering and rollback above, and by running step 6 before closing the old listeners.
- W2 hides buttons in OFF based on `R1`'s behaviour; if the firmware accepts `P1` in OFF, the owner loses a control. Mitigation: the note names the cause, and MANUAL is one tap away.
- The no-current hint can be a false alarm if the pump relay is on but the pump is not running; the wording says "ตรวจ" (check), not "fault".
