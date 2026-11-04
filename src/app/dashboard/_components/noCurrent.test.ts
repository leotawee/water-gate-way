import { describe, expect, it } from "vitest";
import type { GateStatus } from "@/lib/telemetry/parseStatus";
import { noCurrentWhilePumpOn } from "./noCurrent";

type Devices = GateStatus["devices"];

const dev = (o: Partial<Devices>): Devices => ({
  pump: null,
  alarm: null,
  light: null,
  relay1: null,
  relay2: null,
  master1: null,
  ...o,
});
const pz = (current: number | null): GateStatus["pzem"] => ({ voltage: 224, current, frequency: 50, power: 0 });

describe("noCurrentWhilePumpOn", () => {
  it("pump 1 on and 0 A → true", () => {
    expect(noCurrentWhilePumpOn(dev({ pump: true }), pz(0))).toBe(true);
  });
  it("pump 2 on and 0 A → true", () => {
    expect(noCurrentWhilePumpOn(dev({ relay1: true }), pz(0))).toBe(true);
  });
  it("pump on and a real current → false", () => {
    expect(noCurrentWhilePumpOn(dev({ pump: true }), pz(1.2))).toBe(false);
  });
  it("both pumps off and 0 A → false", () => {
    expect(noCurrentWhilePumpOn(dev({ pump: false, relay1: false }), pz(0))).toBe(false);
  });
  it("pump on but current missing (null) → false", () => {
    expect(noCurrentWhilePumpOn(dev({ pump: true }), pz(null))).toBe(false);
  });
  it("pump state unknown (null) and 0 A → false", () => {
    expect(noCurrentWhilePumpOn(dev({}), pz(0))).toBe(false);
  });
  it("no devices or no pzem → false", () => {
    expect(noCurrentWhilePumpOn(null, pz(0))).toBe(false);
    expect(noCurrentWhilePumpOn(dev({ pump: true }), null)).toBe(false);
  });
});
