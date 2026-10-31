"use client";

import { useEffect, useState } from "react";
import { Bell, CircleAlert, Fan, Lightbulb, Power } from "lucide-react";
import type { Command } from "@/lib/control/commands";
import type { GateStatus } from "@/lib/telemetry/parseStatus";
import DeviceSwitch, { type SwitchStatus } from "@/components/DeviceSwitch";

type Devices = GateStatus["devices"];
type DeviceKey = keyof Devices;

function errorText(res: Response): string {
  if (res.status === 429) return `ส่งคำสั่งบ่อยเกินไป รอ ${res.headers.get("Retry-After") ?? "สักครู่"} วินาที`;
  if (res.status === 502) return "อุปกรณ์ไม่พร้อมใช้งาน";
  if (res.status === 403) return "ไม่ได้รับอนุญาต";
  return "ส่งคำสั่งไม่สำเร็จ";
}

/** The command's first letter identifies the device (P1 → pump … Q1 → relay2). */
function deviceOf(cmd: Command): DeviceKey {
  switch (cmd[0]) {
    case "P":
      return "pump";
    case "A":
      return "alarm";
    case "L":
      return "light";
    case "R":
      return "relay1";
    default:
      return "relay2";
  }
}

/** How long to wait for the device to report the target state before saying it did not answer. */
const CONFIRM_MS = 15_000;
/** How long the "device confirmed" line stays visible before the row returns to idle. */
const CONFIRMED_MS = 3_000;

type Note = { key: DeviceKey; target: boolean; cmd: Command; phase: "waiting" | "timeout" | "confirmed" };

type Props = {
  devices: Devices | null;
  stale: boolean;
  /** Viewer mode: the same panel and state readouts, no command buttons, notes or fetch. */
  readOnly?: boolean;
};

/** Operator/admin sends commands (server enforces it too: POST /api/control requires "operator").
 *  WHY: buttons stay enabled when stale; the server is authoritative and an operator may need to
 *  act during an outage. */
export default function ControlPanel({ devices, stale, readOnly = false }: Props) {
  const [sending, setSending] = useState<Command | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  async function sendCommand(cmd: Command) {
    if (sending) return;
    setSending(cmd);
    setError(null);
    try {
      const res = await fetch("/api/control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cmd }),
      });
      if (res.status === 401) {
        window.location.assign("/login?next=" + encodeURIComponent(location.pathname + location.search));
        return;
      }
      if (!res.ok) setError(errorText(res));
      else setNote({ key: deviceOf(cmd), target: cmd.endsWith("1"), cmd, phase: "waiting" });
    } catch {
      setError("ส่งคำสั่งไม่สำเร็จ");
    } finally {
      setSending(null);
    }
  }

  // The device confirmed: it now reports the target state, so say so briefly.
  // WHY: a stale reading may still hold an old value equal to the target; that is not a confirmation.
  useEffect(() => {
    if (note && note.phase === "waiting" && !stale && devices && devices[note.key] === note.target) {
      setNote({ ...note, phase: "confirmed" });
    }
  }, [devices, note, stale]);

  // No confirmation within 15 s: say so and offer a one-tap retry of the same command.
  useEffect(() => {
    if (!note || note.phase !== "waiting") return;
    const id = setTimeout(
      () => setNote((n) => (n && n.phase === "waiting" ? { ...n, phase: "timeout" } : n)),
      CONFIRM_MS,
    );
    return () => clearTimeout(id);
  }, [note]);

  // The confirmed line is brief feedback, not a state: clear it after 3 s.
  useEffect(() => {
    if (!note || note.phase !== "confirmed") return;
    const id = setTimeout(() => setNote((n) => (n && n.phase === "confirmed" ? null : n)), CONFIRMED_MS);
    return () => clearTimeout(id);
  }, [note]);

  const rows = [
    { key: "pump", name: "ปั๊มหลัก", icon: Fan, onCmd: "P1", offCmd: "P0", state: devices?.pump ?? null, tone: "on" },
    { key: "alarm", name: "สัญญาณเตือน", icon: Bell, onCmd: "A1", offCmd: "A0", state: devices?.alarm ?? null, tone: "danger" },
    { key: "light", name: "ไฟส่องสว่าง", icon: Lightbulb, onCmd: "L1", offCmd: "L0", state: devices?.light ?? null, tone: "warn" },
    { key: "relay1", name: "ปั๊ม IoT 1", icon: Power, onCmd: "R1", offCmd: "R0", state: devices?.relay1 ?? null, tone: "on" },
    { key: "relay2", name: "ปั๊ม IoT 2", icon: Power, onCmd: "Q1", offCmd: "Q0", state: devices?.relay2 ?? null, tone: "on" },
  ] as const;

  const rowStatus = (key: DeviceKey): SwitchStatus | null => {
    if (sending && deviceOf(sending) === key) return { phase: "sending", cmd: sending };
    if (note && note.key === key) return { phase: note.phase, cmd: note.cmd };
    return null;
  };

  return (
    <section aria-labelledby="controls-heading" className="rounded-lg border border-border bg-surface">
      <header className="border-b border-border px-4 py-3">
        <h2 id="controls-heading" className="text-base font-bold text-fg">
          {readOnly ? "สถานะอุปกรณ์" : "ควบคุมอุปกรณ์"}
        </h2>
      </header>

      {stale && (
        <div className="hatch flex items-center gap-2.5 border-b border-border px-4 py-2.5 text-sm font-medium text-fg">
          <span className="size-2.5 shrink-0 rounded-full border-2 border-dashed border-unknown" aria-hidden="true" />
          ขาดการเชื่อมต่อ — สถานะอุปกรณ์อาจไม่ตรงความจริง
        </div>
      )}

      {!readOnly && error && (
        <div
          role="alert"
          className="mx-4 mt-3 flex items-center gap-2 rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-danger"
        >
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {error}
        </div>
      )}

      <div className="divide-y divide-border px-4">
        {rows.map((row) => (
          <DeviceSwitch
            key={row.key}
            name={row.name}
            icon={row.icon}
            state={row.state}
            stale={stale}
            onCmd={row.onCmd}
            offCmd={row.offCmd}
            sending={readOnly ? null : sending}
            status={readOnly ? null : rowStatus(row.key)}
            onSend={sendCommand}
            tone={row.tone}
            readOnly={readOnly}
          />
        ))}
      </div>
    </section>
  );
}
