"use client";

import { Check, CircleAlert, Loader2 } from "lucide-react";
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
  /** Command currently in flight (any row), or null. Locks every button without dimming state. */
  sending: Command | null;
  /** This row's command status line, or null when idle (the line still reserves its height). */
  status: SwitchStatus | null;
  onSend: (cmd: Command) => void;
  /** Colour of the "on" end: green by default, warn for the light, danger for the alarm. */
  tone?: "on" | "warn" | "danger";
  /** Read-only: render the same row and state readout without any command buttons or notes. */
  readOnly?: boolean;
};

/** Phase of the last command for one row, shown in the reserved status line. */
export type SwitchStatus =
  | { phase: "sending"; cmd: Command }
  | { phase: "waiting"; cmd: Command }
  | { phase: "timeout"; cmd: Command }
  | { phase: "confirmed"; cmd: Command };

/** Thai command label: the trailing digit is the target state (…1 on, …0 off). */
export function commandLabel(cmd: Command): "สั่งเปิด" | "สั่งปิด" {
  return cmd.endsWith("1") ? "สั่งเปิด" : "สั่งปิด";
}

const TONE = {
  on: { soft: "bg-on-soft text-on", dot: "bg-on", icon: "text-on" },
  warn: { soft: "bg-warn-soft text-warn", dot: "bg-warn", icon: "text-warn" },
  danger: { soft: "bg-danger-soft text-danger", dot: "bg-danger", icon: "text-danger" },
} as const;

/**
 * One device row per DESIGN.md: icon + Thai name, a large state readout pill, and a two-segment
 * switch [ สั่งปิด | สั่งเปิด ]. The segment matching the current state is a soft tint with a
 * check and aria-pressed="true" (it is a state, not the action); the other is the outlined
 * command. Unknown: both read as commands. Under it, one fixed-height status line reports the
 * command lifecycle, so nothing on the row ever jumps while a command is in flight.
 */
export default function DeviceSwitch({
  name,
  icon: Icon,
  state,
  stale,
  onCmd,
  offCmd,
  sending,
  status,
  onSend,
  tone = "on",
  readOnly = false,
}: DeviceSwitchProps) {
  const view = deviceView(state, stale);
  // WHY: every switch locks while any command is in flight, but only the commanded row says so.
  const busy = sending !== null;

  const segment = (which: "off" | "on") => {
    const label = which === "off" ? "สั่งปิด" : "สั่งเปิด";
    const cmd = which === "off" ? offCmd : onCmd;
    const pressed = view === which;
    const softCls = which === "off" ? "bg-off-soft text-off" : TONE[tone].soft;
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={`${label} ${name}`}
        // WHY: aria-disabled instead of disabled — the row keeps its colours (nothing is dimmed)
        // and focus is never thrown away; the click handler refuses the command while busy.
        aria-disabled={busy || undefined}
        onClick={() => {
          if (!busy) onSend(cmd);
        }}
        className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition-colors duration-150 ${
          busy ? "cursor-not-allowed" : "cursor-pointer"
        } ${
          pressed
            ? softCls
            : "border border-fg/30 bg-surface text-fg hover:bg-surface-2"
        }`}
      >
        {pressed && <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />}
        {label}
        {pressed && <span className="sr-only">(สถานะปัจจุบัน)</span>}
      </button>
    );
  };

  const statusLine = () => {
    if (!status) return null;
    const label = commandLabel(status.cmd);
    switch (status.phase) {
      case "sending":
        return (
          <span className="inline-flex items-center gap-2 text-muted">
            <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
            กำลังส่งคำสั่ง: {label}…
          </span>
        );
      case "waiting":
        return <span className="text-accent">ส่งแล้ว: {label} — รออุปกรณ์ยืนยัน</span>;
      case "timeout":
        return (
          <span className="inline-flex items-center gap-2 text-danger">
            <CircleAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            อุปกรณ์ยังไม่ยืนยันคำสั่ง {label}
            <button
              type="button"
              aria-label={`ส่ง ${label} อีกครั้ง`}
              onClick={() => onSend(status.cmd)}
              className="cursor-pointer font-bold underline underline-offset-2 hover:no-underline"
            >
              ส่งอีกครั้ง
            </button>
          </span>
        );
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-2 text-on">
            <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
            อุปกรณ์ยืนยันแล้ว
          </span>
        );
    }
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

        {/* State readout: word + dot, never colour alone. The pill is THE indicator, so it is the
            largest element in the row; min-w keeps the three states equal in width. */}
        <span
          className={`inline-flex min-w-40 items-center justify-center gap-2 rounded-full px-3 py-2 text-base font-bold ${
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

      {!readOnly && (
        <>
          <div role="group" aria-label={`ควบคุม${name}`} className="mt-3 grid grid-cols-2 gap-2">
            {segment("off")}
            {segment("on")}
          </div>

          {/* Reserved status line: always rendered at one fixed height, empty when idle, so
              sending/waiting/timeout/confirmed never push the other rows down. */}
          <p className="mt-2 flex min-h-5 items-center gap-2 text-sm" aria-live="polite">
            {statusLine()}
          </p>
        </>
      )}
    </div>
  );
}
