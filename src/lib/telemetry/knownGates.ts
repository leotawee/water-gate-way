import "server-only";
import { listGates } from "@/lib/gatesDb";
import { LEGACY_GATE } from "./topics";

const REFRESH_MS = 60_000;

type KnownState = { ids: Set<string>; timer: ReturnType<typeof setInterval> | null };

// WHY: globalThis survives Next dev hot reloads, so one set and one timer per process, not per reload.
const g = globalThis as typeof globalThis & { __wgKnownGates?: KnownState };
const state = (): KnownState => (g.__wgKnownGates ??= { ids: new Set([LEGACY_GATE]), timer: null });

/**
 * True for an active registered gate. gate-1 is always known (the legacy topics map to it) and is
 * the only known id until the first successful refresh: ingest fails closed, so a registry outage
 * at boot cannot let arbitrary ids create state or database rows.
 */
export function isKnownGate(gateId: string): boolean {
  return state().ids.has(gateId);
}

/** Replaces the set from the registry; a failed refresh keeps the previous set. */
export async function refreshKnownGates(): Promise<void> {
  try {
    const gates = await listGates();
    state().ids = new Set([LEGACY_GATE, ...gates.map((x) => x.id)]);
  } catch (e) {
    // WHY: message only; the error object may carry query text or row data.
    console.error("[telemetry] known-gates refresh failed:", e instanceof Error ? e.message : "unknown");
  }
}

export function startKnownGatesRefresh(): void {
  const s = state();
  if (s.timer) return;
  void refreshKnownGates();
  s.timer = setInterval(() => void refreshKnownGates(), REFRESH_MS);
  s.timer.unref();
}
