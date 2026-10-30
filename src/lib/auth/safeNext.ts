// WHY: open-redirect guard — only same-origin absolute paths; rejects //host, /\host, schemes.
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  try {
    return new URL(next, "http://x").origin === "http://x" ? next : fallback;
  } catch {
    return fallback;
  }
}
