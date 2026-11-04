import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

const h = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; role: string },
  clients: [] as Array<import("node:events").EventEmitter & { subscribe: ReturnType<typeof vi.fn>; url: string; opts: Record<string, unknown> }>,
}));

vi.mock("./recordLevel", () => ({ recordLevel: vi.fn(async () => {}) }));

vi.mock("mqtt", () => ({
  connect: vi.fn((url: string, opts: Record<string, unknown>) => {
    const c = Object.assign(new EventEmitter(), { subscribe: vi.fn(), url, opts });
    h.clients.push(c);
    return c;
  }),
}));

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

import { subscribeStatus, type StatusEvent } from "./broker";
import { recordLevel } from "./recordLevel";
import { GET, HEAD } from "@/app/api/status/stream/route";
import { requireUser } from "@/lib/auth/dal";

const VALID = JSON.stringify({ pzem: { v: 230 }, pump: 1 });
const client = () => h.clients.at(-1)!;
const listeners = () => (globalThis as { __wgTelemetry?: { listeners: Set<unknown> } }).__wgTelemetry!.listeners.size;
const msg = (payload: string, topic = "stm32/status/all") => client().emit("message", topic, Buffer.from(payload));

beforeEach(() => {
  delete (globalThis as { __wgTelemetry?: unknown }).__wgTelemetry;
  h.clients.length = 0;
  h.user = { id: "u1", email: "v@x.co", role: "viewer" };
  vi.stubEnv("MQTT_URL", "mqtt://127.0.0.1:1883");
  vi.stubEnv("MQTT_USERNAME", "nextjs");
  vi.stubEnv("MQTT_PASSWORD", "pw-not-logged");
  vi.stubEnv("MQTT_TOPIC_STATUS", "water/gate/status");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("broker", () => {
  it("one client per process, credentials from env, both topics", () => {
    subscribeStatus(() => {});
    subscribeStatus(() => {});
    client().emit("connect");
    expect(h.clients).toHaveLength(1);
    expect(client().url).toBe("mqtt://127.0.0.1:1883");
    expect(client().opts).toMatchObject({ username: "nextjs", password: "pw-not-logged" });
    expect(client().subscribe).toHaveBeenCalledWith(
      ["stm32/status/all", "water/gate/person", "water/gate/status"], expect.anything());
  });

  it("does not subscribe MQTT_TOPIC_STATUS twice when equal to the default", () => {
    vi.stubEnv("MQTT_TOPIC_STATUS", "stm32/status/all");
    subscribeStatus(() => {});
    client().emit("connect");
    expect(client().subscribe).toHaveBeenCalledWith(["stm32/status/all", "water/gate/person"], expect.anything());
  });

  it('stream emits {type:"conn", state:"disconnected"} when the client emits offline', () => {
    const got: StatusEvent[] = [];
    subscribeStatus((e) => got.push(e));
    client().emit("connect");
    client().emit("offline");
    expect(got).toEqual([
      { type: "conn", state: "disconnected" },
      { type: "conn", state: "connected" },
      { type: "conn", state: "disconnected" },
    ]);
  });

  it("close and error map to disconnected", () => {
    const got: StatusEvent[] = [];
    subscribeStatus((e) => got.push(e));
    client().emit("connect");
    client().emit("error", new Error("boom"));
    client().emit("connect");
    client().emit("close");
    expect(got.map((e) => (e.type === "conn" ? e.state : e.type))).toEqual([
      "disconnected",
      "connected",
      "disconnected",
      "connected",
      "disconnected",
    ]);
  });

  it("valid payload -> one status event", () => {
    const got: StatusEvent[] = [];
    subscribeStatus((e) => got.push(e));
    msg(VALID);
    const st = got.filter((e) => e.type === "status");
    expect(st).toHaveLength(1);
    expect(st[0].type === "status" && st[0].status.pzem.voltage).toBe(230);
    // the parsed status also goes to the level recorder
    expect(recordLevel).toHaveBeenCalledExactlyOnceWith(st[0].type === "status" ? st[0].status : null, "gate-1");
  });

  it("invalid JSON and non-object payload -> no event, no payload echo in logs", () => {
    const got: StatusEvent[] = [];
    subscribeStatus((e) => got.push(e));
    msg("{not json SECRETISH");
    msg("[1,2]");
    expect(got.filter((e) => e.type === "status")).toHaveLength(0);
    const logged = JSON.stringify(vi.mocked(console.warn).mock.calls);
    expect(logged).not.toContain("SECRETISH");
    expect(vi.mocked(console.warn).mock.calls.length).toBeLessThanOrEqual(1);
  });

  it("new listener immediately receives last conn and last status", () => {
    subscribeStatus(() => {});
    client().emit("connect");
    msg(VALID);
    const got: StatusEvent[] = [];
    subscribeStatus((e) => got.push(e));
    expect(got.map((e) => e.type)).toEqual(["conn", "status"]);
    expect(got[0]).toEqual({ type: "conn", state: "connected" });
  });

  it("unsubscribe removes the listener", () => {
    const got: StatusEvent[] = [];
    const off = subscribeStatus((e) => got.push(e));
    off();
    client().emit("connect");
    msg(VALID);
    expect(got).toHaveLength(1);
  });

  it("a throwing listener does not affect others", () => {
    const got: StatusEvent[] = [];
    subscribeStatus(() => {
      throw new Error("bad listener");
    });
    subscribeStatus((e) => got.push(e));
    client().emit("connect");
    msg(VALID);
    expect(got.map((e) => e.type)).toEqual(["conn", "conn", "status"]);
  });

  it("person message merges into the last real status, not replacing it", () => {
    const got: StatusEvent[] = [];
    subscribeStatus((e) => got.push(e));
    msg(VALID);
    vi.mocked(recordLevel).mockClear();
    msg(JSON.stringify({ person_count: 2, stable: true, source: "pi_yolo" }), "water/gate/person");
    const st = got.filter((e) => e.type === "status");
    expect(st).toHaveLength(2);
    const merged = st[1].type === "status" ? st[1].status : null;
    // personCount updated; the fields from the real status survive the merge
    expect(merged && merged.personCount).toBe(2);
    expect(merged && merged.pzem.voltage).toBe(230);
    expect(merged && merged.devices.pump).toBe(true);
    // detection-only updates must not write water-level rows
    expect(recordLevel).not.toHaveBeenCalled();
  });

  it("a person message never refreshes receivedAt (a dead device must not look fresh)", () => {
    vi.useFakeTimers();
    try {
      const got: StatusEvent[] = [];
      subscribeStatus((e) => got.push(e));
      msg(VALID);
      const first = got.filter((e) => e.type === "status")[0];
      const at0 = first.type === "status" ? first.status.receivedAt : "";
      vi.advanceTimersByTime(20_000);
      msg(JSON.stringify({ person_count: 2 }), "water/gate/person");
      const merged = got.filter((e) => e.type === "status")[1];
      expect(merged.type === "status" && merged.status.receivedAt).toBe(at0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("person message with no prior status emits nothing; the count joins the first real status", () => {
    vi.mocked(recordLevel).mockClear();
    const got: StatusEvent[] = [];
    subscribeStatus((e) => got.push(e));
    msg(JSON.stringify({ person_count: 1 }), "water/gate/person");
    expect(got.filter((e) => e.type === "status")).toHaveLength(0);
    msg(VALID);
    const st = got.filter((e) => e.type === "status");
    expect(st).toHaveLength(1);
    const s = st[0].type === "status" ? st[0].status : null;
    expect(s && s.personCount).toBe(1);
    expect(s && s.pzem.voltage).toBe(230);
    expect(recordLevel).toHaveBeenCalledTimes(1);
  });

  it("invalid person payloads are ignored", () => {
    const got: StatusEvent[] = [];
    subscribeStatus((e) => got.push(e));
    msg("{not json", "water/gate/person");
    msg(JSON.stringify({ no_count: 1 }), "water/gate/person");
    msg(JSON.stringify({ person_count: "abc" }), "water/gate/person");
    msg("[1,2]", "water/gate/person");
    expect(got.filter((e) => e.type === "status")).toHaveLength(0);
  });

  it("a later real status keeps a fresh person count, and drops it once the detector went quiet", () => {
    vi.useFakeTimers();
    try {
      const got: StatusEvent[] = [];
      subscribeStatus((e) => got.push(e));
      msg(VALID);
      msg(JSON.stringify({ person_count: 3 }), "water/gate/person");
      vi.advanceTimersByTime(10_000);
      msg(VALID);
      vi.advanceTimersByTime(25_000); // 35 s since the detector spoke
      msg(VALID);
      const counts = got.filter((e) => e.type === "status").map((e) => (e.type === "status" ? e.status.personCount : -1));
      expect(counts).toEqual([null, 3, 3, null]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("MQTT_URL unset -> disconnected, no client, password never logged", () => {
    vi.stubEnv("MQTT_URL", "");
    const got: StatusEvent[] = [];
    subscribeStatus((e) => got.push(e));
    subscribeStatus(() => {});
    expect(h.clients).toHaveLength(0);
    expect(got).toEqual([{ type: "conn", state: "disconnected" }]);
    const all = JSON.stringify([vi.mocked(console.error).mock.calls, vi.mocked(console.warn).mock.calls]);
    expect(all).not.toContain("pw-not-logged");
  });
});

async function readChunk(res: Response) {
  const reader = res.body!.getReader();
  const { value } = await reader.read();
  return { reader, text: new TextDecoder().decode(value) };
}

describe("GET /api/status/stream", () => {
  it("401 without session, no client created", async () => {
    h.user = null;
    const res = await GET(new Request("http://localhost/api/status/stream"));
    expect(res.status).toBe(401);
    expect(h.clients).toHaveLength(0);
  });

  it("503 generic on non-auth failure", async () => {
    vi.mocked(requireUser).mockRejectedValueOnce(new Error("db down"));
    const res = await GET(new Request("http://localhost/api/status/stream"));
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain("db down");
  });

  it("streams SSE; first chunk is current conn event; abort unsubscribes and closes", async () => {
    subscribeStatus(() => {});
    client().emit("connect");
    const ac = new AbortController();
    const res = await GET(new Request("http://localhost/api/status/stream", { signal: ac.signal }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.headers.get("x-accel-buffering")).toBe("no");
    expect(listeners()).toBe(2);
    const { reader, text } = await readChunk(res);
    expect(text).toBe(`data: ${JSON.stringify({ type: "conn", state: "connected" })}\n\n`);

    msg(VALID);
    const next = new TextDecoder().decode((await reader.read()).value);
    expect(next.startsWith('data: {"type":"status"')).toBe(true);

    ac.abort();
    ac.abort();
    expect((await reader.read()).done).toBe(true);
    expect(listeners()).toBe(1); // only the test's own subscription remains
  });

  it("closes the stream after 10 minutes so the client reconnects and re-authenticates", async () => {
    vi.useFakeTimers();
    try {
      subscribeStatus(() => {});
      const res = await GET(new Request("http://localhost/api/status/stream"));
      const { reader } = await readChunk(res);
      expect(listeners()).toBe(2);
      vi.advanceTimersByTime(10 * 60_000 - 1);
      expect(listeners()).toBe(2);
      vi.advanceTimersByTime(1);
      expect(listeners()).toBe(1);
      // queued pings drain first, then the stream ends
      let r = await reader.read();
      while (!r.done) r = await reader.read();
      expect(r.done).toBe(true);
      expect(vi.getTimerCount()).toBe(0); // ping and lifetime timers both cleared
    } finally {
      vi.useRealTimers();
    }
  });

  it("HEAD: 401 without session, 200 empty with session", async () => {
    h.user = null;
    expect((await HEAD()).status).toBe(401);
    h.user = { id: "u1", email: "v@x.co", role: "viewer" };
    const ok = await HEAD();
    expect(ok.status).toBe(200);
    expect(h.clients).toHaveLength(0);
  });
});
