import type { GateStatus } from "./parseStatus";
import type { GateConn } from "@/hooks/useGateStatus";

export const STALE_MS = 30_000;

/** Telemetry is stale with no stream, no reading yet, or a reading older than 30 s. */
export function isStale(status: GateStatus | null, conn: GateConn, nowMs: number): boolean {
  if (conn !== "connected" || !status) return true;
  const at = Date.parse(status.receivedAt);
  // WHY: NaN > x is false, so an unparseable timestamp must be caught explicitly.
  return !Number.isFinite(at) || nowMs - at > STALE_MS;
}
