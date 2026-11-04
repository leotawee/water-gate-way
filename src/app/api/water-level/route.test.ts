import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  user: null as null | { id: string; email: string; role: string },
  query: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/db", () => {
  h.query = vi.fn(async () => ({ rows: [] }));
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
  return {
    AuthError,
    requireUser: vi.fn(async () => {
      if (!h.user) throw new AuthError("unauthenticated");
      return h.user;
    }),
    authErrorResponse: (e: unknown) =>
      e instanceof AuthError
        ? NextResponse.json({ error: e.code === "unauthenticated" ? "unauthorized" : "forbidden" }, { status: e.code === "unauthenticated" ? 401 : 403 })
        : null,
  };
});

import { GET as history } from "./route";
import { GET as download } from "./download/route";

const req = (path: string, qs = "") => new Request(`http://localhost${path}${qs}`);
const LEGACY = "device_id = 'stm32-radar'";

beforeEach(() => {
  h.user = { id: "u1", email: "a@b.c", role: "viewer" };
  h.query.mockReset();
  h.query.mockResolvedValue({ rows: [] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe.each([
  ["GET /api/water-level", history, "/api/water-level"],
  ["GET /api/water-level/download", download, "/api/water-level/download"],
])("%s", (_name, handler, path) => {
  it("defaults to gate-1 and also matches the legacy device id", async () => {
    const res = await handler(req(path));
    expect(res.status).toBe(200);
    const [sql, params] = h.query.mock.calls[0];
    expect(params).toEqual(["gate-1"]);
    expect(sql).toContain("device_id = $1");
    expect(sql).toContain(LEGACY);
    expect(sql).toContain("$1 = 'gate-1'");
  });

  it("?gate=gate-1 behaves like the default", async () => {
    await handler(req(path, "?gate=gate-1"));
    expect(h.query.mock.calls[0][1]).toEqual(["gate-1"]);
  });

  it("?gate=gate-2 passes gate-2 as the single parameter (legacy clause cannot match it)", async () => {
    await handler(req(path, "?gate=gate-2"));
    const [sql, params] = h.query.mock.calls[0];
    expect(params).toEqual(["gate-2"]);
    // WHY: the legacy value is only reachable through the `$1 = 'gate-1'` guard, false for gate-2.
    expect(sql).toContain("($1 = 'gate-1' AND device_id = 'stm32-radar')");
  });

  it.each(["x", "gate-", "gate-12345", "GATE-1", "gate-1;drop", ""])("?gate=%s -> 400 invalid_gate, no query", async (bad) => {
    const res = await handler(req(path, `?gate=${encodeURIComponent(bad)}`));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_gate" });
    expect(h.query).not.toHaveBeenCalled();
  });

  it("401 when unauthenticated, before any query", async () => {
    h.user = null;
    const res = await handler(req(path));
    expect(res.status).toBe(401);
    expect(h.query).not.toHaveBeenCalled();
  });

  it("503 when the DB fails", async () => {
    h.query.mockRejectedValue(new Error("db down"));
    const res = await handler(req(path));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "Database unavailable" });
  });
});
