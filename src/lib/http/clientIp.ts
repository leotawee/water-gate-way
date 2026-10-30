import { isIP } from "node:net";

// Client IP for rate-limit keys and audit rows; null when no valid proxy header (audit column is inet).
// TECH DEBT: trusts proxy headers; nginx must overwrite X-Forwarded-For
export function clientIp(h: Headers): string | null {
  // WHY: only real IPs pass; a non-IP value would make the inet audit insert fail and drop the row.
  const valid = (v: string | undefined) => (v && isIP(v) !== 0 ? v : null);
  return valid(h.get("x-forwarded-for")?.split(",")[0]?.trim()) ?? valid(h.get("x-real-ip")?.trim()) ?? null;
}
