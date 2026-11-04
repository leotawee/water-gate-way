import "server-only";
import type { GateStatus } from "./parseStatus";
import { db } from "@/lib/db";

export const DEFAULT_SAMPLE_SEC = 300;
const MAX_SAMPLE_SEC = 86_400;

/** WATER_LEVEL_SAMPLE_SEC -> milliseconds. Missing, non-numeric or < 1 -> default; capped at 86400 s. */
export function sampleMs(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, MAX_SAMPLE_SEC) * 1000 : DEFAULT_SAMPLE_SEC * 1000;
}

export function createLevelRecorder(
  insert: (gateId: string, liquid: number, at: Date) => Promise<unknown>,
  sampleMs: number,
): (status: GateStatus, gateId: string) => Promise<void> {
  // Time of the last recorded sample per gate, in receivedAt ms. Number, not Date: only arithmetic is done.
  // WHY per gate: a shared window would let gate-1 samples suppress gate-2's, and a failed gate must not block others.
  const lastAt = new Map<string, number>();
  return async (status: GateStatus, gateId: string) => {
    const liquid = status.radar.liquid;
    const at = new Date(status.receivedAt);
    if (typeof liquid !== "number" || !Number.isFinite(liquid)) return;
    if (Number.isNaN(at.getTime())) return;
    const prev = lastAt.get(gateId);
    if (prev !== undefined && at.getTime() - prev < sampleMs) return;
    // WHY: claim the window before awaiting, so two statuses arriving while an insert is in flight cannot both insert.
    lastAt.set(gateId, at.getTime());
    try {
      await insert(gateId, liquid, at);
    } catch (err) {
      // WHY: never log the payload; keep the window claimed so the retry waits for the next window, no hot loop.
      console.error("[telemetry] level insert failed:", err instanceof Error ? err.message : "unknown");
    }
  };
}

const realInsert = (gateId: string, liquid: number, at: Date) =>
  db.query("insert into water_levels (device_id, water_height, measured_at) values ($1, $2, $3)", [
    gateId,
    liquid,
    at,
  ]);

// WHY TELEMETRY_RECORD=0: the deploy candidate shares the live DB; it must not write duplicate samples.
export const recordLevel: (status: GateStatus, gateId: string) => Promise<void> =
  process.env.TELEMETRY_RECORD === "0"
    ? async () => {}
    : createLevelRecorder(realInsert, sampleMs(process.env.WATER_LEVEL_SAMPLE_SEC));
