"use client";

import { useEffect, useRef, useState } from "react";
import { isTooFarBehind } from "./liveLag";

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
  // WHY: hidden tab drops the <video> so the server stream closes and frees its slot.
  const [hidden, setHidden] = useState(false);
  const lastProgress = useRef(0);
  const requestedAt = useRef(0);
  const startLag = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const retry = () => {
    setStatus("connecting");
    setAttempt((n) => n + 1);
  };

  useEffect(() => {
    requestedAt.current = performance.now();
    startLag.current = null;
  }, [attempt]);

  useEffect(() => {
    const onVisibilityChange = () => {
      const isHidden = document.visibilityState === "hidden";
      setHidden(isHidden);
      if (!isHidden) {
        setStatus("connecting");
        setAttempt((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (status !== "connected" || hidden) return;
    const id = setInterval(() => {
      const stalled = Date.now() - lastProgress.current > STALL_MS;
      // WHY: the HTTP pipe is lossless, so time not played becomes backlog that never drains.
      // Seeking cannot fix it; only a fresh request can.
      const behind =
        videoRef.current !== null &&
        startLag.current !== null &&
        isTooFarBehind((performance.now() - requestedAt.current) / 1000, videoRef.current.currentTime, startLag.current);
      if (stalled || behind) {
        setStatus("connecting");
        setAttempt((n) => n + 1);
      }
    }, 2_000);
    return () => clearInterval(id);
  }, [status, hidden]);

  // WHY: go2rtc's fragmented MP4 over HTTP through the authenticated same-origin proxy, so it needs
  // no WebRTC/ICE and works from any network. The server ends each stream after 10 minutes
  // (session re-check); `ended` then reconnects.
  const src = `/api/camera/stream?src=${encodeURIComponent(streamName)}&n=${attempt}`;
  const displayLabel = label ?? `Office ${streamName.replace("office", "")}`;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-black">
      {!hidden && (
        <video
          ref={videoRef}
          key={attempt}
          src={src}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
          onPlaying={(e) => {
            lastProgress.current = Date.now();
            startLag.current ??= (performance.now() - requestedAt.current) / 1000 - e.currentTarget.currentTime;
            setStatus("connected");
          }}
          onTimeUpdate={() => {
            lastProgress.current = Date.now();
          }}
          onError={() => setStatus("failed")}
          onEnded={() => setTimeout(retry, 1_000)}
        />
      )}

      {/* Status dot */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div
          className={`size-2.5 rounded-full ${
            status === "connected"
              ? "bg-ok"
              : status === "failed"
              ? "bg-danger"
              : "bg-warn animate-pulse"
          }`}
        />
        <span className="text-[11px] font-semibold tracking-wide text-white uppercase">
          {status === "connected" ? "LIVE" : status === "failed" ? "OFFLINE" : "CONNECTING"}
        </span>
      </div>

      {/* Camera label */}
      <div className="absolute bottom-3 left-3 rounded-lg border border-white/10 bg-black/70 px-2.5 py-1 backdrop-blur-sm">
        <span className="font-mono text-xs font-medium text-white">{displayLabel}</span>
      </div>

      {/* Transport badge */}
      <div className="absolute top-3 right-3">
        <span className="rounded-md bg-accent/15 px-2 py-1 font-mono text-[10px] font-semibold text-accent">
          HTTP
        </span>
      </div>

      {/* Loading */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="size-10 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        </div>
      )}

      {/* Error */}
      {status === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center">
            <p className="text-sm font-semibold text-danger">Connection Failed</p>
            <p className="mt-1 font-mono text-xs text-muted">{streamName}</p>
            <button
              onClick={retry}
              className="btn-primary mt-3 min-h-11 px-4"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
