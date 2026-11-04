import type { GateMode } from "@/lib/telemetry/parseStatus";
import type { PillTone } from "@/components/StatePill";

/**
 * The pump rows have no buttons in mode OFF. WHY: the firmware did not act on R1 in OFF, and the Pi's local
 * dashboard only allows pump commands in MANUAL. A stale or missing mode is unknown, so it never locks.
 */
export function pumpsLocked(mode: GateMode | null, stale: boolean): boolean {
  return !stale && mode === "OFF";
}

/** A stale reading must never look live: stale or missing mode is always "unknown". */
export function modeView(mode: GateMode | null, stale: boolean): { tone: PillTone; label: string } {
  if (stale || mode === null) return { tone: "unknown", label: "ไม่ทราบโหมด" };
  if (mode === "AUTO") return { tone: "on", label: "อัตโนมัติ" };
  if (mode === "MANUAL") return { tone: "warn", label: "ควบคุมเอง" };
  return { tone: "off", label: "OFF" };
}
