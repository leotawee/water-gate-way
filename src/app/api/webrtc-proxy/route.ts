import { NextRequest, NextResponse } from "next/server";

/**
 * WebRTC Proxy API Route
 *
 * Proxies WebRTC signaling requests from browser to Raspberry Pi (pi-webrtc)
 * to bypass CORS restrictions.
 *
 * Architecture:
 * Browser → /api/webrtc-proxy → Raspberry Pi (http://192.168.1.151:8000/stream)
 *
 * @route POST /api/webrtc-proxy
 * @param {Object} body - Request body
 * @param {string} body.sdp - SDP offer from browser
 * @param {string} body.type - SDP type (offer)
 * @param {string} body.rtsp_url - RTSP URL of camera
 */

const PI_WEBRTC_URL = "http://192.168.1.151:8000/stream";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sdp, type, rtsp_url } = body;

    console.log("📡 WebRTC Proxy: Forwarding SDP offer to Pi", {
      type,
      rtsp_url: rtsp_url?.replace(/:([^:@]{1,10})@/, ":****@"), // Hide password
    });

    // Proxy request to Raspberry Pi
    const piResponse = await fetch(PI_WEBRTC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sdp,
        type,
        rtsp_url,
      }),
    });

    if (!piResponse.ok) {
      console.error(`❌ Pi returned error: ${piResponse.status} ${piResponse.statusText}`);
      return NextResponse.json(
        { error: `Pi signaling error: ${piResponse.statusText}` },
        { status: piResponse.status }
      );
    }

    // Forward SDP answer from Pi back to browser
    const answerData = await piResponse.json();
    console.log("✅ WebRTC Proxy: Received SDP answer from Pi");

    return NextResponse.json(answerData);
  } catch (error) {
    console.error("❌ WebRTC Proxy error:", error);
    return NextResponse.json(
      { error: "Failed to proxy WebRTC signaling" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for proxy health check
 */
export async function GET(request: NextRequest) {
  try {
    const response = await fetch(PI_WEBRTC_URL, {
      method: "GET",
    });

    const isPiAvailable = response.ok;

    return NextResponse.json({
      proxy: "active",
      pi: isPiAvailable ? "reachable" : "unreachable",
      pi_url: PI_WEBRTC_URL,
    });
  } catch (error) {
    return NextResponse.json({
      proxy: "active",
      pi: "unreachable",
      pi_url: PI_WEBRTC_URL,
      error: "Cannot reach Raspberry Pi",
    });
  }
}
