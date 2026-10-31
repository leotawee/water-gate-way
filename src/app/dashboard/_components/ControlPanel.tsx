"use client";

import { useState } from "react";
import { CircleAlert, Fan, Bell, Lightbulb, Power } from "lucide-react";
import type { Command } from "@/lib/control/commands";
import type { GateStatus } from "@/lib/telemetry/parseStatus";
import { deviceBadge } from "@/lib/telemetry/deviceBadge";

type Devices = GateStatus["devices"];

function errorText(res: Response): string {
  if (res.status === 429) return `Too many commands, wait ${res.headers.get("Retry-After") ?? "a few"} s`;
  if (res.status === 502) return "Device unavailable";
  if (res.status === 403) return "Not allowed";
  return "Command failed";
}

/** Operator/admin only (server enforces it too: POST /api/control requires "operator"). */
// WHY: buttons stay enabled when stale; the server is authoritative and an operator may need to act during an outage.
export default function ControlPanel({ devices, stale }: { devices: Devices | null; stale: boolean }) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCommand(cmd: Command) {
    if (sending) return;
    setSending(true);
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
    } catch {
      setError("Command failed");
    } finally {
      setSending(false);
    }
  }

  // WHY: "on" actions are primary (accent), "off" actions are stop actions (danger outline).
  const onCls = "btn-primary";
  const offCls = "btn-danger";
  const btn = (cmd: Command, text: string, cls: string) => (
    <button onClick={() => sendCommand(cmd)} disabled={sending} className={cls}>
      {text}
    </button>
  );
  const badge = (on: boolean | null, tone: string) => (
    <span className={`pill ${on ? tone : "bg-surface-2 text-muted ring-border"}`}>{deviceBadge(on, stale)}</span>
  );
  const unknownHint = stale && <span className="text-[11px] font-medium text-muted">status unknown (offline)</span>;

  // WHY: when stale, every state reads as null so badges and icons are muted, not last-known colours.
  const v = (x: boolean | null | undefined) => (stale ? null : (x ?? null));
  const pump = v(devices?.pump);
  const alarm = v(devices?.alarm);
  const light = v(devices?.light);
  const relays = [
    { name: "IoT Pump 1", on: v(devices?.relay1), open: "R1", close: "R0" },
    { name: "IoT Pump 2", on: v(devices?.relay2), open: "Q1", close: "Q0" },
  ] as const;

  return (
    <>
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-medium text-danger"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </div>
      )}

      {/* ── Pump Control ── */}
      <div className="card">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="card-title">
              <Fan className="size-4 text-accent" aria-hidden="true" />
              Pump Control
            </h4>
            {unknownHint}
          </div>
          {badge(pump, "bg-ok/10 text-ok ring-ok/40")}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {btn("P1", "เปิดปั๊มปกติ", onCls)}
          {btn("P0", "ปิดปั๊มปกติ", offCls)}
        </div>
      </div>

      {/* ── Alarm & Light ── */}
      <div className="card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h4 className="card-title">Alarm & Light</h4>
          {unknownHint}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Bell className={`size-4 ${alarm ? "text-danger" : "text-muted"}`} aria-hidden="true" />
              <span className="text-sm font-medium text-fg">Alarm</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {badge(alarm, "bg-danger/10 text-danger ring-danger/40")}
              {btn("A1", "เปิด Alarm", onCls)}
              {btn("A0", "ปิด Alarm", offCls)}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Lightbulb className={`size-4 ${light ? "text-warn" : "text-muted"}`} aria-hidden="true" />
              <span className="text-sm font-medium text-fg">Light</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {badge(light, "bg-warn/10 text-warn ring-warn/40")}
              {btn("L1", "เปิดไฟ", onCls)}
              {btn("L0", "ปิดไฟ", offCls)}
            </div>
          </div>
        </div>
      </div>

      {/* ── IoT Relay Pumps ── */}
      <div className="card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h4 className="card-title">IoT Relay Pumps</h4>
          {unknownHint}
        </div>
        <div className="space-y-3">
          {relays.map((r) => (
            <div key={r.open} className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Power className={`size-4 ${r.on ? "text-ok" : "text-muted"}`} aria-hidden="true" />
                <span className="text-sm font-medium text-fg">{r.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {badge(r.on, "bg-ok/10 text-ok ring-ok/40")}
                {btn(r.open, "เปิด", onCls)}
                {btn(r.close, "ปิด", offCls)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
