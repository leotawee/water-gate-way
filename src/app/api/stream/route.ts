import { NextRequest, NextResponse } from "next/server";

/**
 * RTSP to WebRTC Signaling Endpoint
 *
 * This API route handles SDP exchange between frontend and RTSP transcoding backend.
 * For production, you should run a separate transcoding service (e.g., using FFmpeg + WebRTC).
 */

export async function POST(request: NextRequest) {
  try {
    const { sdp, type, rtspUrl } = await request.json();

    console.log("📡 Received SDP Offer for RTSP stream:", {
      type,
      rtspUrl: rtspUrl?.replace(/:([^:@]{1,10})@/, ":****@"), // Hide password
    });

    // TODO: Implement actual RTSP to WebRTC transcoding
    // For now, return a mock SDP answer

    // In production, you would:
    // 1. Start FFmpeg to transcode RTSP to WebRTC format
    // 2. Create an SDP answer from the transcoded stream
    // 3. Return the answer to the frontend

    const mockAnswer = {
      sdp: sdp?.replace("offer", "answer") || "",
      type: "answer",
    };

    return NextResponse.json(mockAnswer);
  } catch (error) {
    console.error("❌ RTSP streaming error:", error);
    return NextResponse.json(
      { error: "Failed to process RTSP stream" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking stream availability
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const rtspUrl = searchParams.get("rtspUrl");

  return NextResponse.json({
    status: "available",
    message: "RTSP signaling endpoint is ready",
    note: "Implement FFmpeg transcoding for production use",
  });
}
