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

import { POST } from "./route";

const APP = "http://localhost:3000";
const OFFER = "v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\n";
const fetchMock = vi.fn();

function req(src: string | null, body: string = OFFER, headers: Record<string, string> = {}) {
  const q = src === null ? "" : `?src=${encodeURIComponent(src)}`;
  return new Request(`${APP}/api/camera/webrtc${q}`, {
    method: "POST",
    headers: { "content-type": "application/sdp", origin: APP, ...headers },
    body,
  });
}

beforeEach(() => {
  h.user = { id: "u1", role: "viewer" };
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("v=0 answer", { status: 201 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/camera/webrtc", () => {
  it("401 without session, upstream never called", async () => {
    h.user = null;
    expect((await POST(req("office1"))).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("403 cross-origin", async () => {
    expect((await POST(req("office1", OFFER, { origin: "https://evil.example" }))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("400 on src outside the allowlist or missing", async () => {
    for (const s of ["office4", "../api/streams", "office1&x=1", null]) {
      expect((await POST(req(s))).status).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("413 when the body exceeds 64 KiB", async () => {
    expect((await POST(req("office1", "a".repeat(64 * 1024 + 1)))).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards the offer to go2rtc (default URL) and returns the answer with upstream status", async () => {
    const res = await POST(req("office2"));
    expect(res.status).toBe(201);
    expect(await res.text()).toBe("v=0 answer");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:1984/api/webrtc?src=office2");
    expect(init).toMatchObject({ method: "POST", body: OFFER, redirect: "error" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses GO2RTC_URL when set", async () => {
    vi.stubEnv("GO2RTC_URL", "http://10.0.0.5:1984/");
    await POST(req("office3"));
    expect(fetchMock.mock.calls[0][0]).toBe("http://10.0.0.5:1984/api/webrtc?src=office3");
  });

  it("upstream 500 -> generic 502", async () => {
    fetchMock.mockResolvedValue(new Response("internal go2rtc detail", { status: 500 }));
    const res = await POST(req("office1"));
    expect(res.status).toBe(502);
    expect(await res.text()).not.toContain("go2rtc detail");
  });

  it("upstream network error / timeout -> generic 502", async () => {
    fetchMock.mockRejectedValue(new DOMException("timed out", "TimeoutError"));
    expect((await POST(req("office1"))).status).toBe(502);
  });
});
