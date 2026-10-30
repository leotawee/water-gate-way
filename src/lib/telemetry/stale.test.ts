import { describe, it, expect } from "vitest";
import { isStale } from "./stale";
import type { GateStatus } from "./parseStatus";

const T0 = Date.parse("2026-10-30T10:00:00.000Z");
const status = { receivedAt: new Date(T0).toISOString() } as GateStatus;

describe("isStale", () => {
  it("null status -> stale", () => expect(isStale(null, "connected", T0)).toBe(true));
  it("disconnected -> stale", () => expect(isStale(status, "disconnected", T0)).toBe(true));
  it("connecting -> stale", () => expect(isStale(status, "connecting", T0)).toBe(true));
  it("29 s old -> fresh", () => expect(isStale(status, "connected", T0 + 29_000)).toBe(false));
  it("31 s old -> stale", () => expect(isStale(status, "connected", T0 + 31_000)).toBe(true));
  it("unparseable receivedAt -> stale", () =>
    expect(isStale({ receivedAt: "garbage" } as GateStatus, "connected", T0)).toBe(true));
});
