import "server-only";
import type { Command } from "./commands";

const TIMEOUT_MS = 5_000;

// Sends one command to FastAPI. Anything other than a 2xx with body status "ok" is "failed".
export async function forwardCommand(cmd: Command): Promise<"sent" | "failed"> {
  const secret = process.env.CONTROL_SHARED_SECRET;
  if (!secret || secret.length < 32) {
    console.error("[control/forward] CONTROL_SHARED_SECRET is missing or shorter than 32 chars");
    return "failed";
  }
  const base = process.env.FASTAPI_URL ?? "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${base}/api/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Control-Token": secret },
      body: JSON.stringify({ command: cmd }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // WHY: never re-send the token to wherever a redirect points.
      redirect: "error",
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[control/forward] FastAPI responded ${res.status}`);
      return "failed";
    }
    const body = (await res.json().catch(() => null)) as { status?: unknown } | null;
    if (body?.status !== "ok") {
      console.error("[control/forward] FastAPI did not accept the command:", String(body?.status));
      return "failed";
    }
    return "sent";
  } catch (e) {
    // WHY: log name/message only; never the request init (it carries the token).
    console.error("[control/forward] request failed:", e instanceof Error ? `${e.name}: ${e.message}` : "unknown");
    return "failed";
  }
}
