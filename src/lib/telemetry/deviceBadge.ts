/** Device state text. WHY: a stale reading must never look live next to a command button. */
export function deviceBadge(value: boolean | null, stale: boolean): "ON" | "OFF" | "—" {
  if (stale || value === null) return "—";
  return value ? "ON" : "OFF";
}
