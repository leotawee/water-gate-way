import type { GateStatus } from "@/lib/telemetry/parseStatus";

/** How long "pump on, no current" must hold before the card says so (the status lags a switch-on by ~2 s). */
export const NO_CURRENT_HOLD_MS = 10_000;

/**
 * A pump relay reports ON while the meter reads exactly 0 A.
 * WHY strict `=== 0`: a missing reading (null) is unknown, not "no current"; an unknown pump state is not "on".
 */
export function noCurrentWhilePumpOn(devices: GateStatus["devices"] | null, pzem: GateStatus["pzem"] | null): boolean {
  if (!devices || !pzem) return false;
  return (devices.pump === true || devices.relay1 === true) && pzem.current === 0;
}
