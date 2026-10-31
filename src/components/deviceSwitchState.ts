/** Visual state of a device. WHY: the switch and the readout must agree on one derivation. */
export type DeviceView = "on" | "off" | "unknown";

/** A stale reading must never look live: stale or missing state is always "unknown". */
export function deviceView(state: boolean | null, stale: boolean): DeviceView {
  if (stale || state === null) return "unknown";
  return state ? "on" : "off";
}
