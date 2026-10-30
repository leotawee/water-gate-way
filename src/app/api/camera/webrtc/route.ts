import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/dal";
import { sameOrigin } from "@/lib/http/sameOrigin";
import { CAMERAS } from "@/lib/gates";

const MAX_BODY = 64 * 1024;
const TIMEOUT_MS = 10_000;
const ALLOWED: ReadonlySet<string> = new Set(CAMERAS);

const err = (error: string, status: number) => NextResponse.json({ error }, { status });

/** Reads at most `max` bytes; null when the body is larger (stops reading early). */
async function readCapped(req: Request, max: number): Promise<string | null> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * POST /api/camera/webrtc?src=<camera> — body: SDP offer; returns go2rtc's SDP answer.
 * WHY: the browser cannot reach go2rtc (private IP, plain http from an https page), so the
 * signalling goes through this authenticated same-origin route. Media still flows over WebRTC.
 */
export async function POST(request: Request) {
  try {
    await requireUser();
  } catch (e) {
    const denied = authErrorResponse(e);
    if (denied) return denied;
    console.error("[API /camera/webrtc] auth lookup failed:", e instanceof Error ? e.message : "unknown");
    return err("unavailable", 503);
  }
  if (!sameOrigin(request)) return err("forbidden", 403);

  const src = new URL(request.url).searchParams.get("src");
  if (!src || !ALLOWED.has(src)) return err("invalid_src", 400);

  const offer = await readCapped(request, MAX_BODY);
  if (offer === null) return err("too_large", 413);

  const base = (process.env.GO2RTC_URL || "http://127.0.0.1:1984").replace(/\/+$/, "");
  try {
    const upstream = await fetch(`${base}/api/webrtc?src=${encodeURIComponent(src)}`, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer,
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!upstream.ok) {
      console.error(`[API /camera/webrtc] go2rtc returned ${upstream.status} for ${src}`);
      return err("camera_unavailable", 502);
    }
    // shortcut: the answer is not size-capped; go2rtc is a trusted LAN service.
    return new Response(await upstream.text(), {
      status: upstream.status,
      headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error("[API /camera/webrtc] go2rtc unreachable:", e instanceof Error ? e.name : "unknown");
    return err("camera_unavailable", 502);
  }
}
