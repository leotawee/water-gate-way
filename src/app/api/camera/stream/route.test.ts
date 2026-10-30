import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ user: null as null | { id: string; role: string } }));

// Fake DAL: same contract as src/lib/auth/dal.ts without cookies/DB.
vi.mock("@/lib/auth/dal", async () => {
  const { NextResponse } = await import("next/server");
  class AuthError extends Error {
    constructor(readonly code: "unauthenticated" | "forbidden") {
      super(code);
    }
  }
  return {
    AuthError,
    requireUser: vi.fn(async () => {
      if (!h.user) throw new AuthError("unauthenticated");
      return h.user;
    }),
    authErrorResponse: (e: unknown) =>
      e instanceof AuthError ? NextResponse.json({ error: "unauthorized" }, { status: 401 }) : null,
  };
});

import { GET } from "./route";

const APP = "http://localhost:3000";
const MP4 = 'video/mp4; codecs="avc1.640029"';
const enc = new TextEncoder();
const fetchMock = vi.fn();

/** A go2rtc-like live response whose body stays open until `end()`. */
function liveUpstream() {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({ start: (c) => void (ctrl = c), cancel });
  return {
    res: new Response(body, { status: 200, headers: { "content-type": MP4 } }),
    push: (s: string) => ctrl.enqueue(enc.encode(s)),
    cancel,
  };
}

function req(src: string | null, init: RequestInit = {}) {
  const q = src === null ? "" : `?src=${encodeURIComponent(src)}`;
  return new Request(`${APP}/api/camera/stream${q}`, init);
}

const text = (v: Uint8Array | undefined) => new TextDecoder().decode(v);

beforeEach(() => {
  h.user = { id: crypto.randomUUID(), role: "viewer" }; // fresh id: the per-user counter is module state
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/camera/stream", () => {
  it("401 without session, upstream never called", async () => {
    h.user = null;
    expect((await GET(req("office1"))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([null, "office9", "../api/streams", "office1&x=1"])(
    "400 for src=%s, upstream never called",
    async (src) => {
      expect((await GET(req(src))).status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  it("403 when the browser says the request is cross-site", async () => {
    const res = await GET(req("office1", { headers: { "sec-fetch-site": "cross-site" } }));
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("streams go2rtc bytes through with video/mp4 and no-store headers", async () => {
    const up = liveUpstream();
    fetchMock.mockResolvedValue(up.res);
    const res = await GET(req("office1"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe(MP4);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:1984/api/stream.mp4?src=office1");
    up.push("abc");
    const reader = res.body!.getReader();
    expect(text((await reader.read()).value)).toBe("abc");
    await reader.cancel();
  });

  it("uses GO2RTC_URL and trims trailing slashes", async () => {
    vi.stubEnv("GO2RTC_URL", "http://100.90.199.55:1984//");
    const up = liveUpstream();
    fetchMock.mockResolvedValue(up.res);
    const res = await GET(req("office2"));
    expect(fetchMock.mock.calls[0][0]).toBe("http://100.90.199.55:1984/api/stream.mp4?src=office2");
    await res.body!.cancel();
  });

  it("502 when go2rtc errors, answers with a non-video type, or is unreachable", async () => {
    fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
    const a = await GET(req("office1"));
    expect(a.status).toBe(502);
    expect(await a.json()).toEqual({ error: "camera_unavailable" });

    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200, headers: { "content-type": "text/html" } }));
    expect((await GET(req("office1"))).status).toBe(502);

    fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect((await GET(req("office1"))).status).toBe(502);
  });

  it("502 when go2rtc does not answer within 10 s", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_, reject) =>
          init.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
        )
    );
    const pending = GET(req("office1"));
    await vi.advanceTimersByTimeAsync(10_000);
    expect((await pending).status).toBe(502);
  });

  it("client disconnect (request abort) cancels the upstream stream", async () => {
    const up = liveUpstream();
    fetchMock.mockResolvedValue(up.res);
    const ac = new AbortController();
    const res = await GET(req("office1", { signal: ac.signal }));
    up.push("x");
    await res.body!.getReader().read();
    ac.abort();
    await vi.waitFor(() => expect(up.cancel).toHaveBeenCalled());
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal!.aborted).toBe(true);
  });

  it("closing the response body cancels the upstream stream", async () => {
    const up = liveUpstream();
    fetchMock.mockResolvedValue(up.res);
    const res = await GET(req("office1"));
    await res.body!.cancel();
    await vi.waitFor(() => expect(up.cancel).toHaveBeenCalled());
  });

  it("429 on the 7th concurrent stream for one user; a slot frees on disconnect", async () => {
    const ups: ReturnType<typeof liveUpstream>[] = [];
    fetchMock.mockImplementation(async () => {
      const u = liveUpstream();
      ups.push(u);
      return u.res;
    });
    const open: Response[] = [];
    for (let i = 0; i < 6; i++) {
      const r = await GET(req("office1"));
      expect(r.status).toBe(200);
      open.push(r);
    }
    const seventh = await GET(req("office1"));
    expect(seventh.status).toBe(429);
    expect(await seventh.json()).toEqual({ error: "too_many_streams" });
    expect(fetchMock).toHaveBeenCalledTimes(6);

    await open[0].body!.cancel();
    const again = await GET(req("office1"));
    expect(again.status).toBe(200);
    open.push(again);
    await Promise.all(open.slice(1).map((r) => r.body!.cancel()));
  });

  it("a rejected request does not use up a slot", async () => {
    for (let i = 0; i < 10; i++) {
      fetchMock.mockResolvedValueOnce(new Response("boom", { status: 500 }));
      expect((await GET(req("office1"))).status).toBe(502);
    }
    const up = liveUpstream();
    fetchMock.mockResolvedValueOnce(up.res);
    const res = await GET(req("office1"));
    expect(res.status).toBe(200);
    await res.body!.cancel();
  });

  it("ends the stream after 10 minutes so a revoked session stops receiving video", async () => {
    vi.useFakeTimers();
    const up = liveUpstream();
    fetchMock.mockResolvedValue(up.res);
    const res = await GET(req("office1"));
    const reader = res.body!.getReader();
    up.push("a");
    expect(text((await reader.read()).value)).toBe("a");

    await vi.advanceTimersByTimeAsync(10 * 60_000 - 1);
    expect(up.cancel).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect((await reader.read()).done).toBe(true);
    expect(up.cancel).toHaveBeenCalled();
  });
});
