// Client IP for rate-limit keys and audit rows; null when no proxy header (audit column is inet).
// TECH DEBT: trusts proxy headers; nginx must overwrite X-Forwarded-For
export function clientIp(h: Headers): string | null {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || null;
}
