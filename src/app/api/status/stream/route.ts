import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/dal";
import { subscribeStatus } from "@/lib/telemetry/broker";

// WHY: per-user, long-lived response; must never be prerendered or cached.
export const dynamic = "force-dynamic";

const PING_MS = 25_000;
// WHY: forces the EventSource to reconnect, which re-runs requireUser (revoked sessions stop streaming).
const MAX_LIFETIME_MS = 10 * 60_000;
const enc = new TextEncoder();
// WHY: each open stream is a broker subscriber plus a timer held for up to MAX_LIFETIME_MS; an account that opens
// them without limit (any viewer, including a self sign-up) would grow memory until the 256 MB container dies.
const MAX_STREAMS_PER_USER = 6;
// TECH DEBT: in-process counter; move to Redis when horizontally scaled.
const openStreams = new Map<string, number>();

/** The signed-in user id, or the 401/403/503 response when the caller may not read telemetry. */
async function authenticate(): Promise<{ userId: string } | { deny: Response }> {
  try {
    return { userId: (await requireUser()).id };
  } catch (e) {
    const res = authErrorResponse(e);
    if (res) return { deny: res };
    console.error("[status/stream] auth check failed:", e instanceof Error ? e.message : "unknown");
    return { deny: NextResponse.json({ error: "unavailable" }, { status: 503 }) };
  }
}

// WHY: EventSource hides the status code; the client hook probes HEAD to tell 401 from a network drop.
export async function HEAD(): Promise<Response> {
  const auth = await authenticate();
  return "deny" in auth ? auth.deny : new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  const auth = await authenticate();
  if ("deny" in auth) return auth.deny;
  const { userId } = auth;
  const open = openStreams.get(userId) ?? 0;
  if (open >= MAX_STREAMS_PER_USER) {
    return NextResponse.json({ error: "too_many_streams" }, { status: 429, headers: { "Retry-After": "10" } });
  }
  openStreams.set(userId, open + 1);

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
        // WHY inside the `closed` guard: cancel(), abort and the lifetime timer can all fire; the slot is freed once.
        const left = (openStreams.get(userId) ?? 1) - 1;
        if (left > 0) openStreams.set(userId, left);
        else openStreams.delete(userId);
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
