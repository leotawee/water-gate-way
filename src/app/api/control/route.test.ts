import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; role: string },
  query: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/db", () => {
  h.query = vi.fn(async () => ({ rows: [], rowCount: 1 }));
  return { db: { query: h.query } };
});

// Fake DAL: same contract as src/lib/auth/dal.ts without cookies/DB.
vi.mock("@/lib/auth/dal", async () => {
  const { NextResponse } = await import("next/server");
  class AuthError extends Error {
    constructor(readonly code: "unauthenticated" | "forbidden") {
      super(code);
      this.name = "AuthError";
    }
  }
  const rank: Record<string, number> = { viewer: 0, operator: 1, admin: 2 };
  return {
    AuthError,
    requireUser: vi.fn(async (min: string) => {
      if (!h.user) throw new AuthError("unauthenticated");
      if ((rank[h.user.role] ?? -1) < (rank[min] ?? Infinity)) throw new AuthError("forbidden");
      return h.user;
    }),
    authErrorResponse: (e: unknown) =>
      e instanceof AuthError
        ? NextResponse.json({ error: e.code === "unauthenticated" ? "unauthorized" : "forbidden" }, { status: e.code === "unauthenticated" ? 401 : 403 })
        : null,
  };
});

vi.mock("@/lib/control/forward", () => ({ forwardCommand: vi.fn(async () => "sent") }));

import { POST } from "./route";
import { forwardCommand } from "@/lib/control/forward";
import { requireUser } from "@/lib/auth/dal";

const APP = "http://localhost:3000";
let seq = 0;

function req(body: unknown, headers: Record<string, string> = {}, raw = false) {
  return new Request(`${APP}/api/control`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP, "x-forwarded-for": "203.0.113.9, 10.0.0.1", ...headers },
    body: raw ? (body as string) : JSON.stringify(body),
  });
}
const audits = () =>
  h.query.mock.calls.filter(([sql]) => /insert into control_audit/i.test(sql as string)).map(([, p]) => p as unknown[]);

beforeEach(() => {
  vi.clearAllMocks();
  // WHY: controlByUser is a module singleton; a fresh user id per test keeps buckets independent.
  h.user = { id: `00000000-0000-0000-0000-${String(++seq).padStart(12, "0")}`, email: "op@x.co", role: "operator" };
  vi.mocked(forwardCommand).mockResolvedValue("sent");
});

describe("POST /api/control", () => {
  it("401 without session, forwardCommand not called", async () => {
    h.user = null;
    const res = await POST(req({ command: "P1" }) as never);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(forwardCommand).not.toHaveBeenCalled();
    expect(audits()).toHaveLength(0);
  });

  it("viewer -> 403, forwardCommand not called", async () => {
    h.user!.role = "viewer";
    const res = await POST(req({ command: "P1" }) as never);
    expect(res.status).toBe(403);
    expect(forwardCommand).not.toHaveBeenCalled();
  });

  it("ZZ -> 400 invalid_command + audit rejected", async () => {
    const res = await POST(req({ command: "ZZ" }) as never);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_command" });
    expect(forwardCommand).not.toHaveBeenCalled();
    expect(audits()).toEqual([[h.user!.id, "ZZ", "rejected", "203.0.113.9"]]);
  });

  it("malformed JSON -> 400 invalid_command + audit rejected", async () => {
    const res = await POST(req("{not json", {}, true) as never);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_command" });
    expect(audits()).toEqual([[h.user!.id, "", "rejected", "203.0.113.9"]]);
  });

  it("valid -> 200 + audit sent (normalized command)", async () => {
    const res = await POST(req({ command: " p1 " }) as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, command: "P1" });
    expect(forwardCommand).toHaveBeenCalledWith("P1");
    expect(audits()).toEqual([[h.user!.id, "P1", "sent", "203.0.113.9"]]);
  });

  it("x-real-ip fallback, and null ip when no proxy header", async () => {
    await POST(req({ command: "P1" }, { "x-forwarded-for": "", "x-real-ip": "198.51.100.4" }) as never);
    await POST(req({ command: "P0" }, { "x-forwarded-for": "" }) as never);
    expect(audits().map((a) => a[3])).toEqual(["198.51.100.4", null]);
  });

  it("garbage x-forwarded-for on a valid command -> 200, audit ip null (insert cannot fail on inet)", async () => {
    const res = await POST(req({ command: "P1" }, { "x-forwarded-for": "x" }) as never);
    expect(res.status).toBe(200);
    expect(audits()).toEqual([[h.user!.id, "P1", "sent", null]]);
  });

  it("zone-id x-forwarded-for on a valid command -> 200, audit ip null", async () => {
    const res = await POST(req({ command: "P1" }, { "x-forwarded-for": "fe80::1%eth0" }) as never);
    expect(res.status).toBe(200);
    expect(audits()).toEqual([[h.user!.id, "P1", "sent", null]]);
  });

  it("audit insert failure with an ip retries once with ip null", async () => {
    h.query.mockRejectedValueOnce(new Error("invalid input syntax for type inet"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ command: "P1" }) as never);
    expect(res.status).toBe(200);
    expect(audits()).toEqual([
      [h.user!.id, "P1", "sent", "203.0.113.9"],
      [h.user!.id, "P1", "sent", null],
    ]);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("11th command in a minute is 429", async () => {
    for (let i = 0; i < 10; i++) expect((await POST(req({ command: "P1" }) as never)).status).toBe(200);
    const res = await POST(req({ command: "P1" }) as never);
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    const ra = Number(res.headers.get("retry-after"));
    expect(ra).toBeGreaterThanOrEqual(1);
    expect(ra).toBeLessThanOrEqual(60);
    expect(forwardCommand).toHaveBeenCalledTimes(10);
    expect(audits().at(-1)).toEqual([h.user!.id, "P1", "rate_limited", "203.0.113.9"]);
  });

  it("invalid commands do not consume the rate limit", async () => {
    for (let i = 0; i < 12; i++) await POST(req({ command: "ZZ" }) as never);
    expect((await POST(req({ command: "P1" }) as never)).status).toBe(200);
  });

  it("FastAPI 503 -> 502 to client, audit status failed", async () => {
    vi.mocked(forwardCommand).mockResolvedValue("failed");
    const res = await POST(req({ command: "P1" }) as never);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "device_unavailable" });
    expect(audits()).toEqual([[h.user!.id, "P1", "failed", "203.0.113.9"]]);
  });

  it("audit insert failure does not turn a sent command into an error", async () => {
    h.query.mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req({ command: "P1" }) as never);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("foreign Origin -> 403 before auth", async () => {
    const res = await POST(req({ command: "P1" }, { origin: "https://evil.example" }) as never);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "forbidden" });
    expect(requireUser).not.toHaveBeenCalled();
    expect(forwardCommand).not.toHaveBeenCalled();
  });

  it("missing Origin -> 403", async () => {
    const r = req({ command: "P1" });
    r.headers.delete("origin");
    const res = await POST(r as never);
    expect(res.status).toBe(403);
    expect(requireUser).not.toHaveBeenCalled();
  });

  it("Origin matching x-forwarded-proto + host (TLS at nginx) is accepted", async () => {
    const res = await POST(
      req({ command: "P1" }, { origin: "https://gate.example", "x-forwarded-proto": "https", host: "gate.example" }) as never,
    );
    expect(res.status).toBe(200);
  });

  it("Origin matching x-forwarded-host is accepted; mismatched scheme is not", async () => {
    const ok = await POST(
      req({ command: "P1" }, { origin: "https://gate.example", "x-forwarded-proto": "https", "x-forwarded-host": "gate.example" }) as never,
    );
    expect(ok.status).toBe(200);
    const bad = await POST(
      req({ command: "P1" }, { origin: "http://gate.example", "x-forwarded-proto": "https", host: "gate.example" }) as never,
    );
    expect(bad.status).toBe(403);
  });
});
