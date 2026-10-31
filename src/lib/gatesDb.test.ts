import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  query: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/db", () => {
  h.query = vi.fn(async () => ({ rows: [] as unknown[], rowCount: 0 }));
  return { db: { query: h.query } };
});

import { listGates, getGate } from "./gatesDb";

const ROW = {
  id: "gate-1",
  name: "Gate 1 - Nam Ping",
  location: "Nam Ping",
  lat: 18.795,
  lng: 99.015,
  has_device: true,
  active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listGates", () => {
  it("returns active gates only by default, with the flag as a bound parameter", async () => {
    h.query.mockResolvedValueOnce({ rows: [ROW] });
    const gates = await listGates();
    const [sql, params] = h.query.mock.calls[0];
    expect(sql).toMatch(/from gates/);
    expect(params).toEqual([false]);
    expect(gates).toEqual([
      { id: "gate-1", name: "Gate 1 - Nam Ping", location: "Nam Ping", lat: 18.795, lng: 99.015, hasDevice: true, active: true },
    ]);
  });

  it("includeInactive binds true", async () => {
    await listGates({ includeInactive: true });
    expect(h.query.mock.calls[0][1]).toEqual([true]);
  });
});

describe("getGate", () => {
  it("returns the whitelisted gate (no location/active) for an active id", async () => {
    h.query.mockResolvedValueOnce({ rows: [ROW] });
    expect(await getGate("gate-1")).toEqual({ id: "gate-1", name: "Gate 1 - Nam Ping", lat: 18.795, lng: 99.015, hasDevice: true });
    const [sql, params] = h.query.mock.calls[0];
    expect(sql).toMatch(/where id = \$1 and active/);
    expect(params).toEqual(["gate-1"]);
  });

  it("missing or inactive gate -> null", async () => {
    h.query.mockResolvedValueOnce({ rows: [] });
    expect(await getGate("gate-2")).toBeNull();
  });

  it.each([undefined, "", "gate-", "gate-12345", "GATE-1", "gate-1 ", "gate-1; drop table gates", "__proto__", "../gate-1"])(
    "invalid id %j -> null, no query",
    async (id) => {
      expect(await getGate(id)).toBeNull();
      expect(h.query).not.toHaveBeenCalled();
    },
  );
});
