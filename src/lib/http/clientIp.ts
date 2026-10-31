import { isIP } from "node:net";

// Client IP for rate-limit keys and audit rows; null when no valid proxy header (audit column is inet).
// TECH DEBT: trusts proxy headers; the app must be reachable only through the proxy that sets them
// (nginx overwriting X-Forwarded-For, or cloudflared setting CF-Connecting-IP), never directly.
export function clientIp(h: Headers): string | null {
  // WHY: only real IPs pass; a non-IP value would make the inet audit insert fail and drop the row.
  // isIP accepts IPv6 zone ids ("fe80::1%eth0") but Postgres inet does not, so reject "%".
  const valid = (v: string | undefined) => (v && !v.includes("%") && isIP(v) !== 0 ? v : null);
  // WHY: behind Cloudflare Tunnel only CF-Connecting-IP is set by the proxy; X-Forwarded-For and
  // X-Real-IP then come from the client, so no fallback to them (a spoofed value would dodge rate limits).
  if (process.env.CLIENT_IP_HEADER === "cf-connecting-ip") return valid(h.get("cf-connecting-ip")?.trim());
  return valid(h.get("x-forwarded-for")?.split(",")[0]?.trim()) ?? valid(h.get("x-real-ip")?.trim()) ?? null;
}
