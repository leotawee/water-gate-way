"use client";

import { useState } from "react";
import { Fan, Bell, Lightbulb, Power } from "lucide-react";
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

  const btn = (cmd: Command, text: string, cls: string) => (
    <button
      onClick={() => sendCommand(cmd)}
      disabled={sending}
      className={`${cls} transition-all disabled:opacity-50`}
    >
      {text}
    </button>
  );
  const small = "px-3 py-1.5 rounded-lg text-xs font-bold";
  const offCls = `${small} bg-gray-200 text-gray-600 hover:bg-gray-300`;
  const badge = (on: boolean | null, onCls: string) => (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${on ? onCls : "bg-gray-100 text-gray-400"}`}>
      {deviceBadge(on, stale)}
    </span>
  );
  const unknownHint = stale && <span className="text-[10px] font-medium text-gray-400">status unknown (offline)</span>;

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
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      {/* ── Pump Control ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Fan className="w-5 h-5 text-blue-500" />
            <h4 className="font-bold text-gray-800">Pump Control</h4>
            {unknownHint}
          </div>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              pump ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-400"
            }`}
          >
            {deviceBadge(pump, stale)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {btn(
            "P1",
            "เปิดปั๊มปกติ",
            "py-2.5 rounded-xl text-sm font-bold bg-blue-500 text-white shadow-md shadow-blue-500/25 hover:bg-blue-600 active:bg-blue-700 duration-200",
          )}
          {btn(
            "P0",
            "ปิดปั๊มปกติ",
            "py-2.5 rounded-xl text-sm font-bold bg-red-500 text-white shadow-md shadow-red-500/25 hover:bg-red-600 active:bg-red-700 duration-200",
          )}
        </div>
      </div>

      {/* ── Alarm & Light ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Alarm & Light</h4>
          {unknownHint}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className={`w-4 h-4 ${alarm ? "text-red-500" : "text-gray-400"}`} />
              <span className="text-sm font-medium text-gray-700">Alarm</span>
            </div>
            <div className="flex items-center gap-2">
              {badge(alarm, "bg-red-100 text-red-600")}
              {btn("A1", "เปิด Alarm", `${small} bg-red-500 text-white hover:bg-red-600 active:bg-red-700`)}
              {btn("A0", "ปิด Alarm", offCls)}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className={`w-4 h-4 ${light ? "text-yellow-500" : "text-gray-400"}`} />
              <span className="text-sm font-medium text-gray-700">Light</span>
            </div>
            <div className="flex items-center gap-2">
              {badge(light, "bg-yellow-100 text-yellow-700")}
              {btn("L1", "เปิดไฟ", `${small} bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700`)}
              {btn("L0", "ปิดไฟ", offCls)}
            </div>
          </div>
        </div>
      </div>

      {/* ── IoT Relay Pumps ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center gap-2 mb-3">
          <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider">IoT Relay Pumps</h4>
          {unknownHint}
        </div>
        <div className="space-y-3">
          {relays.map((r) => (
            <div key={r.open} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Power className={`w-4 h-4 ${r.on ? "text-green-500" : "text-gray-400"}`} />
                <span className="text-sm font-medium text-gray-700">{r.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {badge(r.on, "bg-green-100 text-green-600")}
                {btn(r.open, "เปิด", `${small} bg-green-500 text-white hover:bg-green-600 active:bg-green-700`)}
                {btn(r.close, "ปิด", offCls)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
