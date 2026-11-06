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
const OFFER = "v=0\r\no=- 4611731400430051336 2 IN IP4 127.0.0.1\r\ns=-\r\n";
const ANSWER = "v=0\r\no=- 111 2 IN IP4 192.168.1.199\r\ns=-\r\n";
let fetchMock = vi.fn();

function req(src: string | null, init: RequestInit = {}) {
  const q = src === null ? "" : `?src=${encodeURIComponent(src)}`;
  return new Request(`${APP}/api/camera/webrtc${q}`, {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin" },
    ...init,
  });
}

beforeEach(() => {
  h.user = { id: "u1", role: "operator" };
  vi.stubGlobal("fetch", (fetchMock = vi.fn()));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/camera/webrtc rate limit", () => {
  it("allows 60 offers a minute per user, then 429 with Retry-After, without touching go2rtc", async () => {
    h.user = { id: "rl-user", role: "viewer" };
    fetchMock.mockImplementation(async () => new Response(ANSWER, { status: 201 }));
    for (let i = 0; i < 60; i++) expect((await POST(req("office1", { body: OFFER }))).status).toBe(200);
    fetchMock.mockClear();
    const res = await POST(req("office1", { body: OFFER }));
    expect(res.status).toBe(429);
    expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not let one user's flood block another user", async () => {
    h.user = { id: "rl-other", role: "viewer" };
    fetchMock.mockImplementation(async () => new Response(ANSWER, { status: 201 }));
    expect((await POST(req("office2", { body: OFFER }))).status).toBe(200);
  });
});

describe("POST /api/camera/webrtc", () => {
  it("requires a session", async () => {
    h.user = null;
    const res = await POST(req("office1", { body: OFFER }));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(["office9", null, ""])("rejects unknown src %j", async (src) => {
    const res = await POST(req(src, { body: OFFER }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a body that is not an SDP offer", async () => {
    const res = await POST(req("office1", { body: "hello" }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("relays the offer to go2rtc and returns the answer as application/sdp", async () => {
    fetchMock.mockResolvedValue(new Response(ANSWER, { status: 200 }));
    const res = await POST(req("office1", { body: OFFER }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/sdp");
    expect(await res.text()).toBe(ANSWER);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:1984/api/webrtc?src=office1");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/sdp");
    expect(init.body).toBe(OFFER);
  });

  it("maps a go2rtc rejection to 502 camera_unavailable", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const res = await POST(req("office2", { body: OFFER }));
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe("camera_unavailable");
  });

  it("maps an unreachable go2rtc to 502 camera_unavailable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const res = await POST(req("office3", { body: OFFER }));
    expect(res.status).toBe(502);
  });

  it("refuses cross-site calls", async () => {
    const res = await POST(
      req("office1", { body: OFFER, headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
