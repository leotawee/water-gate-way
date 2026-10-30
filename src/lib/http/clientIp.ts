import { isIP } from "node:net";

// Client IP for rate-limit keys and audit rows; null when no valid proxy header (audit column is inet).
// TECH DEBT: trusts proxy headers; nginx must overwrite X-Forwarded-For
export function clientIp(h: Headers): string | null {
  // WHY: only real IPs pass; a non-IP value would make the inet audit insert fail and drop the row.
  // isIP accepts IPv6 zone ids ("fe80::1%eth0") but Postgres inet does not, so reject "%".
  const valid = (v: string | undefined) => (v && !v.includes("%") && isIP(v) !== 0 ? v : null);
  return valid(h.get("x-forwarded-for")?.split(",")[0]?.trim()) ?? valid(h.get("x-real-ip")?.trim()) ?? null;
}
