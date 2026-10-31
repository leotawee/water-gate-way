"use client";

import { Check, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Command } from "@/lib/control/commands";
import { deviceView } from "./deviceSwitchState";

export type DeviceSwitchProps = {
  /** Thai device name, shown next to the icon and inside each button's accessible name. */
  name: string;
  icon: LucideIcon;
  /** Reported state; null when the payload did not include it. */
  state: boolean | null;
  /** Stale telemetry: the state is unknown no matter the last value. */
  stale: boolean;
  onCmd: Command;
  offCmd: Command;
  /** Command currently in flight, or null. */
  sending: Command | null;
  onSend: (cmd: Command) => void;
  /** Colour of the "on" end: green by default, warn for the light, danger for the alarm. */
  tone?: "on" | "warn" | "danger";
};

const TONE = {
  on: { solid: "bg-on text-white", soft: "bg-on-soft text-on", dot: "bg-on", icon: "text-on" },
  warn: { solid: "bg-warn text-white", soft: "bg-warn-soft text-warn", dot: "bg-warn", icon: "text-warn" },
  danger: { solid: "bg-danger text-white", soft: "bg-danger-soft text-danger", dot: "bg-danger", icon: "text-danger" },
} as const;

/**
 * One device row per DESIGN.md: icon + Thai name, a large state readout, and a two-segment
 * switch [ ปิด | เปิด ]. The segment matching the current state is filled with a check and
 * aria-pressed="true"; the other is outlined and is the action. Unknown: neither filled.
 */
export default function DeviceSwitch({
  name,
  icon: Icon,
  state,
  stale,
  onCmd,
  offCmd,
  sending,
  onSend,
  tone = "on",
}: DeviceSwitchProps) {
  const view = deviceView(state, stale);
  // WHY: every switch locks while any command is in flight, but only the commanded row says so.
  const busy = sending !== null;
  const mine = sending === onCmd || sending === offCmd;

  const segment = (which: "off" | "on") => {
    const label = which === "off" ? "ปิด" : "เปิด";
    const cmd = which === "off" ? offCmd : onCmd;
    const pressed = view === which;
    const filled = pressed;
    const fillCls =
      which === "off" ? "bg-off text-white hover:bg-off/85" : `${TONE[tone].solid} hover:opacity-90`;
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={`${label} ${name}`}
        disabled={busy}
        onClick={() => onSend(cmd)}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
          filled ? fillCls : "border border-border bg-surface text-fg hover:bg-surface-2"
        }`}
      >
        {filled && <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />}
        {label}
      </button>
    );
  };

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Icon
            className={`size-5 shrink-0 ${view === "on" ? TONE[tone].icon : view === "off" ? "text-off" : "text-muted"}`}
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="text-base font-bold text-fg">{name}</span>
        </div>

        {/* State readout: word + dot, never colour alone. */}
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${
            view === "on"
              ? TONE[tone].soft
              : view === "off"
                ? "bg-off-soft text-off"
                : "hatch border border-border text-muted"
          }`}
        >
          <span
            aria-hidden="true"
            className={`size-2.5 shrink-0 rounded-full ${
              view === "on"
                ? TONE[tone].dot
                : view === "off"
                  ? "bg-off"
                  : "border-2 border-dashed border-unknown"
            }`}
          />
          {view === "on" ? "ทำงาน" : view === "off" ? "ปิดอยู่" : "ไม่ทราบสถานะ"}
        </span>
      </div>

      <div role="group" aria-label={`ควบคุม${name}`} className="mt-3 grid grid-cols-2 gap-2">
        {segment("off")}
        {segment("on")}
      </div>

      {mine && (
        <p className="mt-2 flex items-center gap-2 text-sm text-muted" aria-live="polite">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          กำลังส่งคำสั่ง…
        </p>
      )}
    </div>
  );
}
