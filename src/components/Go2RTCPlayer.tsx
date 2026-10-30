"use client";

import { useEffect, useRef, useState } from "react";

interface Go2RTCPlayerProps {
  streamName: string;
  label?: string;
}

type Status = "connecting" | "connected" | "failed";

// WHY: a frozen picture must not stay labelled LIVE. Progressive MP4 gives no error when the
// camera drops, so playback progress is the only signal.
const STALL_MS = 8_000;

export default function Go2RTCPlayer({ streamName, label }: Go2RTCPlayerProps) {
  const [status, setStatus] = useState<Status>("connecting");
  // Bumping `attempt` remounts <video>, which opens a fresh HTTP stream.
  const [attempt, setAttempt] = useState(0);
  const lastProgress = useRef(0);

  const retry = () => {
    setStatus("connecting");
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    if (status !== "connected") return;
    const id = setInterval(() => {
      if (Date.now() - lastProgress.current > STALL_MS) {
        setStatus("connecting");
        setAttempt((n) => n + 1);
      }
    }, 2_000);
    return () => clearInterval(id);
  }, [status]);

  // WHY: go2rtc's fragmented MP4 over HTTP through the authenticated same-origin proxy, so it needs
  // no WebRTC/ICE and works from any network. The server ends each stream after 10 minutes
  // (session re-check); `ended` then reconnects.
  const src = `/api/camera/stream?src=${encodeURIComponent(streamName)}&n=${attempt}`;
  const displayLabel = label ?? `Office ${streamName.replace("office", "")}`;

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-gray-700 shadow-lg">
      <video
        key={attempt}
        src={src}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
        onPlaying={() => {
          lastProgress.current = Date.now();
          setStatus("connected");
        }}
        onTimeUpdate={() => {
          lastProgress.current = Date.now();
        }}
        onError={() => setStatus("failed")}
        onEnded={() => setTimeout(retry, 1_000)}
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
          {status === "connected" ? "LIVE" : status === "failed" ? "OFFLINE" : "CONNECTING"}
        </span>
      </div>

      {/* Camera label */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/10">
        <span className="text-white text-xs font-bold">{displayLabel}</span>
      </div>

      {/* Transport badge */}
      <div className="absolute top-3 right-3">
        <span className="text-[9px] font-mono font-bold text-cyan-400 bg-cyan-400/10 px-2 py-1 rounded-md">
          HTTP
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
              onClick={retry}
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
