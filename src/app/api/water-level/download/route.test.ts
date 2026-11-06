import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  user: null as null | { id: string; role: string },
  query: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/db", () => {
  h.query = vi.fn();
  return { db: { query: h.query } };
});

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

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: "u1", role: "viewer" };
  h.query.mockResolvedValue({
    rows: [{ id: 2, device_id: "stm32-radar", water_height: 1.5, measured_at: new Date("2026-11-05T13:12:38.557Z") }],
  });
});

describe("GET /api/water-level/download", () => {
  it("requires a session and reads nothing without one", async () => {
    h.user = null;
    expect((await GET()).status).toBe(401);
    expect(h.query).not.toHaveBeenCalled();
  });

  // REGRESSION: the query had no WHERE and no LIMIT, so one viewer could load the whole table into a 256 MB container.
  it("never reads the whole table: 90 days and at most 200000 rows, as parameters", async () => {
    await GET();
    const [sql, params] = h.query.mock.calls[0];
    expect(sql).toMatch(/where\s+measured_at\s*>=/i);
    expect(sql).toMatch(/limit\s+\$2/i);
    expect(params).toEqual([90, 200_000]);
  });

  it("returns a CSV with a header and one line per row", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv");
    expect(await res.text()).toBe(
      "id,device_id,water_height,measured_at\n2,stm32-radar,1.5,2026-11-05T13:12:38.557Z",
    );
  });

  it("answers 503 JSON, not a broken file, when the database fails", async () => {
    h.query.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});
