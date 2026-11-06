import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ user: null as null | { id: string; role: string }, unsubscribe: null as unknown as ReturnType<typeof import("vitest").vi.fn> }));

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

vi.mock("@/lib/telemetry/broker", () => {
  h.unsubscribe = vi.fn();
  return { subscribeStatus: vi.fn(() => h.unsubscribe) };
});

import { GET, HEAD } from "./route";

const get = () => GET(new Request("http://localhost:3000/api/status/stream"));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/status/stream", () => {
  it("requires a session", async () => {
    h.user = null;
    expect((await get()).status).toBe(401);
  });

  it("caps open streams at 6 per user and frees a slot when one closes", async () => {
    h.user = { id: "sse-a", role: "viewer" };
    const open = [];
    for (let i = 0; i < 6; i++) {
      const res = await get();
      expect(res.status).toBe(200);
      open.push(res);
    }
    const refused = await get();
    expect(refused.status).toBe(429);
    expect(await refused.json()).toEqual({ error: "too_many_streams" });

    await open[0].body!.cancel(); // the tab closed
    expect(h.unsubscribe).toHaveBeenCalledTimes(1);
    expect((await get()).status).toBe(200);
    await Promise.all(open.slice(1).map((r) => r.body!.cancel()));
  });

  it("counts per user, not globally", async () => {
    h.user = { id: "sse-b", role: "viewer" };
    const mine = [];
    for (let i = 0; i < 6; i++) mine.push(await get());
    h.user = { id: "sse-c", role: "viewer" };
    const theirs = await get();
    expect(theirs.status).toBe(200);
    await theirs.body!.cancel();
    await Promise.all(mine.map((r) => r.body!.cancel()));
  });

  it("does not leak a slot when the same stream is cancelled twice", async () => {
    h.user = { id: "sse-d", role: "viewer" };
    const res = await get();
    await res.body!.cancel();
    await res.body!.cancel().catch(() => {});
    const again = [];
    for (let i = 0; i < 6; i++) again.push(await get());
    expect(again.every((r) => r.status === 200)).toBe(true);
    expect((await get()).status).toBe(429);
    await Promise.all(again.map((r) => r.body!.cancel()));
  });
});

describe("HEAD /api/status/stream", () => {
  it("is the cheap auth probe: 200 with a session and never opens a stream", async () => {
    h.user = { id: "sse-e", role: "viewer" };
    expect((await HEAD()).status).toBe(200);
    h.user = null;
    expect((await HEAD()).status).toBe(401);
  });
});
