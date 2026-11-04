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
  /** This row's command status line, or null when idle (the line still reserves its height). */
  status: SwitchStatus | null;
  onSend: (cmd: Command) => void;
  /** Colour of the "on" end: green by default, warn for the light, danger for the alarm. */
  tone?: "on" | "warn" | "danger";
  /** Read-only: render the same row and state readout without any command buttons or notes. */
  readOnly?: boolean;
  /** A line under the row explaining why it has no buttons (e.g. the firmware owns this output). */
  note?: string;
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

// Solid fill for the segment that matches the reported state; white on each of these is >= 4.5:1.
const TONE = {
  on: { solid: "bg-on text-white", tint: "bg-on-soft text-on", dot: "bg-on" },
  warn: { solid: "bg-warn text-white", tint: "bg-warn-soft text-warn", dot: "bg-warn" },
  danger: { solid: "bg-danger text-white", tint: "bg-danger-soft text-danger", dot: "bg-danger" },
} as const;

/** Status line shared by device rows and the mode selector. */
export function StatusLine({ status, label, onRetry }: { status: SwitchStatus | null; label: string; onRetry: () => void }) {
  if (!status) return null;
  switch (status.phase) {
    case "sending":
      return (
        <span className="anim-rise-in inline-flex items-center gap-2 text-muted">
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
          กำลังส่ง: {label}…
        </span>
      );
    case "waiting":
      return <span className="anim-rise-in text-fg">ส่งแล้ว: {label} รออุปกรณ์ยืนยัน</span>;
    case "timeout":
      return (
        <span className="anim-rise-in inline-flex flex-wrap items-center gap-x-2 text-danger">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          อุปกรณ์ยังไม่ยืนยัน {label}
          <button
            type="button"
            aria-label={`ส่ง ${label} อีกครั้ง`}
            onClick={onRetry}
            className="cursor-pointer font-bold underline underline-offset-2 hover:no-underline"
          >
            ส่งอีกครั้ง
          </button>
        </span>
      );
    case "confirmed":
      return (
        <span className="anim-rise-in inline-flex items-center gap-2 text-on">
          <Check className="size-4" strokeWidth={1.75} aria-hidden="true" />
          อุปกรณ์ยืนยันแล้ว
        </span>
      );
  }
}

/**
 * One device row: icon + Thai name + a state word, and a two-segment control [ ปิด | เปิด ].
 * The segment that matches the reported state is a solid fill (it IS the state, so it carries
 * aria-pressed); the other is an outlined command. Unknown state: both look like commands.
 * A command in flight puts a spinner in the segment that was pressed, so the operator sees what
 * was sent; only THIS row's buttons wait, the other rows stay usable. One fixed-height status
 * line under the row reports the lifecycle, so nothing jumps.
 */
export default function DeviceSwitch({
  name,
  icon: Icon,
  state,
  stale,
  onCmd,
  offCmd,
  status,
  onSend,
  tone = "on",
  readOnly = false,
  note,
}: DeviceSwitchProps) {
  const view = deviceView(state, stale);
  // WHY: lock only while this row's own command is on the wire; confirmation is tracked by the status line.
  const inFlight = status?.phase === "sending";

  const segment = (which: "off" | "on") => {
    const label = which === "off" ? "ปิด" : "เปิด";
    const cmd = which === "off" ? offCmd : onCmd;
    const pressed = view === which;
    const sendingThis = inFlight && status.cmd === cmd;
    const fill = pressed ? (which === "off" ? "bg-off text-white" : TONE[tone].solid) : "bg-surface text-fg hover:bg-surface-2";
    return (
      <button
        type="button"
        aria-pressed={pressed}
        aria-label={`${commandLabel(cmd)} ${name}`}
        aria-disabled={inFlight || undefined}
        onClick={() => {
          if (!inFlight) onSend(cmd);
        }}
        className={`inline-flex min-h-11 w-full min-w-20 items-center justify-center sm:w-auto gap-1.5 px-4 text-sm font-bold transition-colors duration-(--dur-base) active:translate-y-px ${
          inFlight ? "cursor-progress" : "cursor-pointer"
        } ${fill}`}
      >
        {sendingThis ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : (
          pressed && <Check className="size-4" strokeWidth={2.25} aria-hidden="true" />
        )}
        {label}
        {pressed && <span className="sr-only">(สถานะปัจจุบัน)</span>}
      </button>
    );
  };

  const stateWord = view === "on" ? "ทำงาน" : view === "off" ? "ปิดอยู่" : "ไม่ทราบสถานะ";

  return (
    <div className="py-3">
      <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-(--dur-base) ${
              view === "on" ? TONE[tone].tint : view === "off" ? "bg-off-soft text-off" : "bg-surface-2 text-muted"
            }`}
          >
            <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-fg">{name}</p>
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <span
                aria-hidden="true"
                className={`size-2 shrink-0 rounded-full ${
                  view === "on" ? TONE[tone].dot : view === "off" ? "bg-off" : "border-[1.5px] border-unknown"
                }`}
              />
              {stateWord}
            </p>
          </div>
        </div>

        {!readOnly && (
          <div
            role="group"
            aria-label={`ควบคุม${name}`}
            className="grid shrink-0 grid-cols-2 divide-x divide-control overflow-hidden rounded-xl border border-control sm:inline-flex"
          >
            {segment("off")}
            {segment("on")}
          </div>
        )}
      </div>

      {note && <p className="mt-1.5 pl-[3.25rem] text-sm text-muted">{note}</p>}

      {/* Reserved status line: always rendered at one fixed height, empty when idle. */}
      {!readOnly && (
        <p className="mt-1.5 flex min-h-5 items-center gap-2 pl-[3.25rem] text-sm" aria-live="polite">
          {status && <StatusLine status={status} label={commandLabel(status.cmd)} onRetry={() => onSend(status.cmd)} />}
        </p>
      )}
    </div>
  );
}
