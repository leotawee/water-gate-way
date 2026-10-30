"use client";

import { useEffect, useRef, useState } from "react";

interface Go2RTCPlayerProps {
  streamName: string;
  label?: string;
}

type Status = "idle" | "connecting" | "connected" | "failed";

export default function Go2RTCPlayer({
  streamName,
  label,
}: Go2RTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    let pc: RTCPeerConnection;
    let mounted = true;
    const video = videoRef.current;

    const connect = async () => {
      if (!mounted) return;
      setStatus("connecting");

      try {
        pc = new RTCPeerConnection({
          iceServers: [], // Pure LAN P2P — no STUN/TURN
        });
        pcRef.current = pc;

        pc.ontrack = (e) => {
          if (videoRef.current && e.streams[0]) {
            videoRef.current.srcObject = e.streams[0];
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (!mounted) return;
          const s = pc.iceConnectionState;
          if (s === "connected" || s === "completed") setStatus("connected");
          else if (s === "failed" || s === "disconnected") setStatus("failed");
        };

        pc.addTransceiver("video", { direction: "recvonly" });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // WHY: same-origin authenticated proxy; the browser never talks to go2rtc directly.
        const res = await fetch(
          `/api/camera/webrtc?src=${encodeURIComponent(streamName)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/sdp" },
            body: offer.sdp,
          }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const answerSdp = await res.text();
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: answerSdp })
        );
      } catch (err) {
        console.error(`[Go2RTC] ${streamName}:`, err);
        if (mounted) setStatus("failed");
      }
    };

    connect();

    return () => {
      mounted = false;
      pcRef.current?.close();
      pcRef.current = null;
      if (video) video.srcObject = null;
    };
  }, [streamName]);

  const displayLabel = label ?? `Office ${streamName.replace("office", "")}`;

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-gray-700 shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Status dot */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            status === "connected"
              ? "bg-green-500 animate-pulse"
              : status === "failed"
              ? "bg-red-500"
              : "bg-yellow-400 animate-pulse"
          }`}
        />
        <span className="text-[10px] font-bold text-white uppercase tracking-tight">
          {status === "connected"
            ? "P2P LIVE"
            : status === "failed"
            ? "OFFLINE"
            : "CONNECTING"}
        </span>
      </div>

      {/* Camera label */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
        <span className="text-white text-xs font-bold">{displayLabel}</span>
      </div>

      {/* WebRTC badge */}
      <div className="absolute top-3 right-3">
        <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-md">
          WEBRTC P2P
        </span>
      </div>

      {/* Loading */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {status === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <p className="text-red-400 text-sm font-bold">Connection Failed</p>
            <p className="text-gray-500 text-xs mt-1">{streamName}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
