import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/dal";
import { subscribeStatus } from "@/lib/telemetry/broker";

// WHY: per-user, long-lived response; must never be prerendered or cached.
export const dynamic = "force-dynamic";

const PING_MS = 25_000;
// WHY: forces the EventSource to reconnect, which re-runs requireUser (revoked sessions stop streaming).
const MAX_LIFETIME_MS = 10 * 60_000;
const enc = new TextEncoder();

/** null when the caller may read telemetry; otherwise the 401/403/503 response. */
async function denied(): Promise<Response | null> {
  try {
    await requireUser();
    return null;
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return res;
    console.error("[status/stream] auth check failed:", e instanceof Error ? e.message : "unknown");
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}

// WHY: EventSource hides the status code; the client hook probes HEAD to tell 401 from a network drop.
export async function HEAD(): Promise<Response> {
  return (await denied()) ?? new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  const deny = await denied();
  if (deny) return deny;

  let cleanup = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let ping: ReturnType<typeof setInterval> | null = null;
      let lifetime: ReturnType<typeof setTimeout> | null = null;

      cleanup = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        if (ping) clearInterval(ping);
        if (lifetime) clearTimeout(lifetime);
        try {
          controller.close();
        } catch {
          // already closed or cancelled by the reader
        }
      };
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          cleanup();
        }
      };

      unsubscribe = subscribeStatus((e) => send(`data: ${JSON.stringify(e)}\n\n`));
      ping = setInterval(() => send(": ping\n\n"), PING_MS);
      lifetime = setTimeout(() => cleanup(), MAX_LIFETIME_MS);
      if (request.signal.aborted) cleanup();
      else request.signal.addEventListener("abort", () => cleanup(), { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
