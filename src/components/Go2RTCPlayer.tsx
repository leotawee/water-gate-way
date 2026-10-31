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
  // WHY: labels come from the grid position (กล้อง 1, กล้อง 2, …); the fallback never shows a raw
  // stream id to users.
  const displayLabel = label ?? "กล้อง";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
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

      {/* Status: dot + word (never colour alone). z-10 keeps both chips readable above the
          connecting/failed overlays instead of dimmed underneath them. */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`size-2.5 rounded-full ${
            status === "connected" ? "bg-on" : status === "failed" ? "bg-danger" : "bg-warn animate-pulse"
          }`}
        />
        <span className="text-xs font-bold text-white">
          {status === "connected" ? "สด" : status === "failed" ? "ออฟไลน์" : "กำลังเชื่อมต่อ"}
        </span>
      </div>

      {/* Camera label: small white chip */}
      <div className="absolute bottom-3 left-3 z-10 rounded-md bg-white px-2 py-1">
        <span className="text-xs font-bold text-fg">{displayLabel}</span>
      </div>

      {/* Loading */}
      {status === "connecting" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="size-10 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        </div>
      )}

      {/* Error. WHY: centred with side padding so the heading clears the status chip at 375px and
          at the 2-up desktop width; secondary (outline) styling stays readable on black. */}
      {status === "failed" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-4">
          <div className="flex max-w-full flex-col items-center gap-3 text-center">
            <p className="text-sm font-bold text-white">เชื่อมต่อกล้องไม่สำเร็จ</p>
            <button
              onClick={retry}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-white/40 bg-transparent px-4 text-sm font-bold text-white transition-colors duration-150 hover:bg-white/10"
            >
              ลองอีกครั้ง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
