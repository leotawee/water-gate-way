import { NextResponse } from "next/server";
import { requireUser, authErrorResponse } from "@/lib/auth/dal";
import { CAMERAS } from "@/lib/gates";

export const dynamic = "force-dynamic";

const ALLOWED: ReadonlySet<string> = new Set(CAMERAS);
const RELAY_TIMEOUT_MS = 10_000;
// An SDP offer is a few KB at most; anything bigger is abuse or a client bug.
const MAX_OFFER_BYTES = 64 * 1024;

const err = (error: string, status: number) => NextResponse.json({ error }, { status });

/**
 * POST /api/camera/webrtc?src=<camera> — WebRTC signaling relay (WHEP style).
 *
 * The browser cannot reach go2rtc on the Pi directly (the Pi sits on the site LAN / tailnet), so
 * this route carries the SDP offer to go2rtc and the SDP answer back — one short request each.
 * After the answer, ICE connects the browser to the Pi DIRECTLY (UDP, STUN-assisted via the
 * candidates already configured in go2rtc.yml): the video bytes never touch this server or the
 * Cloudflare tunnel, which is why this transport survives where the fMP4 proxy (see ../stream)
 * gets cut by the tunnel.
 *
 * Auth and the same-origin check match /api/camera/stream. The relay is one-shot, so there is no
 * slot accounting here — capacity is bounded by the Pi's WebRTC listener, not by this process.
 */
export async function POST(request: Request): Promise<Response> {
  let userId: string;
  try {
    const user = await requireUser();
    userId = user.id;
  } catch (e) {
    const denied = authErrorResponse(e);
    if (denied) return denied;
    console.error("[API /camera/webrtc] auth lookup failed:", e instanceof Error ? e.message : "unknown");
    return err("unavailable", 503);
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") return err("forbidden", 403);

  const src = new URL(request.url).searchParams.get("src");
  if (!src || !ALLOWED.has(src)) return err("invalid_src", 400);

  const offer = await request.text();
  if (!offer || !offer.startsWith("v=0") || offer.length > MAX_OFFER_BYTES) return err("invalid_sdp", 400);

  const base = (process.env.GO2RTC_URL || "http://127.0.0.1:1984").replace(/\/+$/, "");
  let res: Response;
  try {
    res = await fetch(`${base}/api/webrtc?src=${encodeURIComponent(src)}`, {
      method: "POST",
      headers: { "Content-Type": "application/sdp" },
      body: offer,
      signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
    });
  } catch (e) {
    console.error("[API /camera/webrtc] go2rtc unreachable:", e instanceof Error ? e.message : "unknown");
    return err("camera_unavailable", 502);
  }
  if (!res.ok) {
    console.error(`[API /camera/webrtc] go2rtc rejected the offer for ${src}: HTTP ${res.status}`);
    return err("camera_unavailable", 502);
  }

  const answer = await res.text();
  // One audit line per established session (who watched what, when).
  console.log(`[API /camera/webrtc] ${userId} ${src}: relayed, answer ${answer.length}B`);
  return new Response(answer, {
    status: 200,
    headers: { "Content-Type": "application/sdp", "Cache-Control": "no-store" },
  });
}
