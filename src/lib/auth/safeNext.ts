// WHY: open-redirect guard — only same-origin absolute paths; rejects //host, /\host, schemes.
// Control chars are rejected because the URL parser strips tab/CR/LF, turning "/\t/x" into "//x".
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  if (/[\x00-\x1f\x7f]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://x");
    // WHY: return the parsed form, never the raw input, so what we redirect to is what we checked.
    return u.origin === "http://x" ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}
