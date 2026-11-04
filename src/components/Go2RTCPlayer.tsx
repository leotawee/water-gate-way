"use client";

// FULL REWRITE: progressive <video src> replaced by MSE fed from the same authenticated route.
import { useEffect, useRef, useState } from "react";
import { useRedirectToLogin } from "@/hooks/useRedirectToLogin";
import { liveEdgeAction } from "./liveEdge";

interface Go2RTCPlayerProps {
  streamName: string;
  label?: string;
}

type Status = "connecting" | "connected" | "failed";

// WHY: a frozen picture must not stay labelled LIVE; playback progress is the only reliable signal.
const STALL_MS = 8_000;
// WHY: a request that never produces a playing frame (headers then silence, a hung proxy) must fail.
const CONNECT_TIMEOUT_MS = 15_000;
// After this many failures in a row the tile says "ออฟไลน์" (with a retry-now button), but it keeps retrying.
const MAX_FAILURES = 3;
// WHY: never give up. A dashboard left on a wall must come back by itself after a network drop or a Pi
// reboot; before, three quick refusals left every camera offline until someone clicked.
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 30_000;

// Safari on iOS 17.1+ exposes MSE only as ManagedMediaSource.
type MSCtor = typeof MediaSource;
function mediaSourceCtor(): MSCtor | null {
  const w = window as unknown as { ManagedMediaSource?: MSCtor; MediaSource?: MSCtor };
  return w.ManagedMediaSource ?? w.MediaSource ?? null;
}

/**
 * Live camera tile. WHY MSE: go2rtc's fragmented MP4 over a plain `<video src>` never autoplays in
 * Chrome (autoplay waits for HAVE_ENOUGH_DATA, which a live file whose duration equals its buffer
 * never reaches, and a paused element stops downloading after ~3 s), and a forced start hits `ended`
 * at the buffer end. MSE with an infinite duration plays continuously and keeps the playhead ~0.3 s
 * behind the newest frame (measured ~2 s glass-to-glass). Same HTTP route, so auth, the per-user and
 * global stream caps, and the 10-minute cut all still apply.
 */
export default function Go2RTCPlayer({ streamName, label }: Go2RTCPlayerProps) {
  const [status, setStatus] = useState<Status>("connecting");
  // Bumping `attempt` remounts <video> and opens a fresh stream.
  const [attempt, setAttempt] = useState(0);
  // WHY: a hidden tab drops the stream so the server closes it and frees the slot.
  const [hidden, setHidden] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastProgress = useRef(0);
  const failures = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetry = () => {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = null;
  };
  const reconnect = () => {
    clearRetry();
    setStatus("connecting");
    setAttempt((n) => n + 1);
  };
  const retry = () => {
    failures.current = 0;
    reconnect();
  };
  const fail = () => {
    failures.current += 1;
    setStatus(failures.current >= MAX_FAILURES ? "failed" : "connecting");
    // Backoff 2, 4, 8, 16, 30, 30 … s, so a long outage does not hammer the server or the Pi.
    const delay = Math.min(RETRY_BASE_MS * 2 ** (failures.current - 1), RETRY_MAX_MS);
    clearRetry();
    retryTimer.current = setTimeout(() => {
      retryTimer.current = null;
      setAttempt((n) => n + 1);
    }, delay);
  };
  // WHY: effects below capture these by closure; a ref keeps them current without re-running the stream effect.
  const redirectToLogin = useRedirectToLogin();
  const actions = useRef({ fail, reconnect, redirectToLogin });
  actions.current = { fail, reconnect, redirectToLogin };

  useEffect(() => {
    const onVisibilityChange = () => {
      const isHidden = document.visibilityState === "hidden";
      setHidden(isHidden);
      if (!isHidden) {
        if (retryTimer.current) clearTimeout(retryTimer.current);
        retryTimer.current = null;
        failures.current = 0;
        setStatus("connecting");
        setAttempt((n) => n + 1);
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      // the tile is gone: a pending retry must not fire into an unmounted component
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, []);

  // The stream: fetch the fMP4 body and append it to a MediaSource.
  useEffect(() => {
    const video = videoRef.current;
    if (hidden || !video) return;
    const abort = new AbortController();
    const src = `/api/camera/stream?src=${encodeURIComponent(streamName)}&n=${attempt}`;
    const MS = mediaSourceCtor();
    let objectUrl: string | null = null;

    // Fallback without MSE: plain progressive playback, started explicitly (autoplay alone never starts it).
    if (!MS) {
      video.src = src;
      const start = () => void video.play().catch(() => {});
      video.addEventListener("loadeddata", start);
      return () => {
        video.removeEventListener("loadeddata", start);
        video.removeAttribute("src");
        video.load();
      };
    }

    const run = async () => {
      const res = await fetch(src, { cache: "no-store", signal: abort.signal });
      if (res.status === 401) {
        actions.current.redirectToLogin();
        return;
      }
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !res.body || !MS.isTypeSupported(type)) throw new Error(`stream ${res.status} ${type}`);

      const ms = new MS();
      objectUrl = URL.createObjectURL(ms);
      // WHY: ManagedMediaSource only opens when remote playback (AirPlay) is disabled.
      video.disableRemotePlayback = true;
      video.src = objectUrl;
      await new Promise<void>((resolve) => ms.addEventListener("sourceopen", () => resolve(), { once: true }));
      const sb = ms.addSourceBuffer(type);
      sb.mode = "segments";
      ms.duration = Infinity;

      const queue: Uint8Array<ArrayBuffer>[] = [];
      const pump = () => {
        if (sb.updating || queue.length === 0 || ms.readyState !== "open") return;
        try {
          sb.appendBuffer(queue.shift()!);
        } catch {
          // QuotaExceededError: drop the backlog and resync at the live edge on the next fragment.
          queue.length = 0;
        }
      };
      sb.addEventListener("updateend", () => {
        const b = sb.buffered;
        const act = liveEdgeAction(
          b.length ? { start: b.start(0), end: b.end(b.length - 1), currentTime: video.currentTime } : null,
        );
        if (act.seekTo !== null) video.currentTime = act.seekTo;
        if (act.trimBefore !== null && !sb.updating) {
          sb.remove(0, act.trimBefore);
          return; // the remove fires updateend again, which pumps the queue
        }
        if (video.paused) void video.play().catch(() => {});
        pump();
      });

      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        // The server ends each stream after 10 minutes (session re-check); reconnect.
        if (done) return actions.current.reconnect();
        // WHY: fetch body chunks are always backed by a plain ArrayBuffer (never shared memory).
        queue.push(value as Uint8Array<ArrayBuffer>);
        pump();
      }
    };

    run().catch((e: unknown) => {
      if (abort.signal.aborted) return;
      if (process.env.NODE_ENV !== "production") console.debug(`[camera] ${streamName}:`, e);
      actions.current.fail();
    });

    return () => {
      abort.abort(); // closes the HTTP stream, so the server frees the slot
      video.removeAttribute("src");
      video.load();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, hidden, streamName]);

  // Connect timeout: no playing frame within 15 s counts as a failed attempt (also while "failed",
  // so a background retry that hangs cannot stall the retry loop).
  useEffect(() => {
    if (status === "connected" || hidden) return;
    const id = setTimeout(() => actions.current.fail(), CONNECT_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [status, hidden, attempt]);

  // Stall watchdog: no playback progress for 8 s while connected means a frozen picture; reconnect.
  useEffect(() => {
    if (status !== "connected" || hidden) return;
    const id = setInterval(() => {
      if (Date.now() - lastProgress.current > STALL_MS) actions.current.reconnect();
    }, 2_000);
    return () => clearInterval(id);
  }, [status, hidden]);

  // WHY: labels come from the grid position (กล้อง 1, กล้อง 2, …); the fallback never shows a raw stream id.
  const displayLabel = label ?? "กล้อง";

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {!hidden && (
        <video
          ref={videoRef}
          key={attempt}
          muted
          playsInline
          aria-label={displayLabel}
          className="h-full w-full object-cover"
          onPlaying={() => {
            lastProgress.current = Date.now();
            failures.current = 0;
            setStatus("connected");
          }}
          onTimeUpdate={() => {
            lastProgress.current = Date.now();
          }}
          // MSE sources never end; this only fires on the progressive fallback.
          onEnded={() => setTimeout(reconnect, 1_000)}
        />
      )}

      {/* Status: dot + word (never colour alone). z-10 keeps both chips readable above the
          connecting/failed overlays instead of dimmed underneath them. */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span
          aria-hidden="true"
          className={`size-2.5 rounded-full transition-colors duration-(--dur-base) ${
            status === "connected" ? "bg-on" : status === "failed" ? "bg-danger" : "bg-warn"
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

      {/* WHY one persistent overlay: connecting/failed flip constantly (10-min server cut, backoff,
          tab return); the motion policy (globals.css) reserves keyframes for one-shot appearances, so
          visibility is a class toggle on a never-unmounting overlay instead of conditional mounts. */}
      <div
        aria-hidden={status === "connected" || undefined}
        className={`cam-overlay absolute inset-0 flex items-center justify-center ${
          status === "failed" ? "bg-black/80" : "bg-black/60"
        } ${status === "connected" ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        {status === "connecting" && (
          <div className="size-8 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
        )}
        {status === "failed" && (
          <div className="flex max-w-full flex-col items-center gap-3 px-4 text-center">
            <p className="text-sm font-bold text-white">เชื่อมต่อกล้องไม่สำเร็จ</p>
            <button
              onClick={retry}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-white/40 bg-transparent px-4 text-sm font-bold text-white transition-colors duration-150 hover:bg-white/10"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
