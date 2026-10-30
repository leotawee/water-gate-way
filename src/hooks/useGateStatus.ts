"use client";

import { useEffect, useState } from "react";
import type { GateStatus } from "@/lib/telemetry/parseStatus";

export type GateConn = "connecting" | "connected" | "disconnected";

const STREAM_URL = "/api/status/stream";
const RETRY_MS = 5_000;

/** Live gate telemetry from the authenticated SSE stream (same origin, session cookie). */
export function useGateStatus(): { status: GateStatus | null; conn: GateConn } {
  const [status, setStatus] = useState<GateStatus | null>(null);
  const [conn, setConn] = useState<GateConn>("connecting");

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;
    let probing = false;

    const open = () => {
      es = new EventSource(STREAM_URL);
      es.onmessage = (m) => {
        let e: { type?: string; state?: GateConn; status?: GateStatus };
        try {
          e = JSON.parse(m.data);
        } catch {
          return;
        }
        if (e.type === "status" && e.status) setStatus(e.status);
        else if (e.type === "conn" && (e.state === "connected" || e.state === "disconnected")) setConn(e.state);
      };
      es.onerror = () => {
        setConn("disconnected");
        if (probing) return;
        probing = true;
        // WHY: EventSource hides the status code; HEAD runs the same auth check without opening a stream.
        fetch(STREAM_URL, { method: "HEAD", cache: "no-store" })
          .then((r) => r.status === 401)
          .catch(() => false)
          .then((unauthorized) => {
            probing = false;
            if (disposed) return;
            if (unauthorized) {
              es?.close();
              window.location.assign("/login?next=" + encodeURIComponent(location.pathname + location.search));
              return;
            }
            // WHY: a non-200 response (e.g. 503) closes EventSource for good; reopen it ourselves.
            if (es?.readyState === EventSource.CLOSED && !retry) {
              retry = setTimeout(() => {
                retry = null;
                if (!disposed) open();
              }, RETRY_MS);
            }
          });
      };
    };

    open();
    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      es?.close();
    };
  }, []);

  return { status, conn };
}
