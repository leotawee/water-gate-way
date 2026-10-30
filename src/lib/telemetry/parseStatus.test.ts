import { describe, expect, it } from "vitest";
import { parseStatus } from "./parseStatus";
import { FORMAT_A, FORMAT_B } from "./fixtures";

const now = new Date("2026-10-30T07:00:01.000Z");
const iso = now.toISOString();

describe("parseStatus", () => {
  it("parses Format A", () => {
    expect(parseStatus(FORMAT_A, now)).toEqual({
      pzem: { voltage: 229.8, current: 1.42, frequency: 50, power: 321.5 },
      radar: { liquid: null, airGap: 1.85 },
      float: { f1: true, f2: false },
      wireBreak: { red: true, blue: null },
      devices: { pump: true, alarm: false, light: null, relay1: null, relay2: null },
      personCount: 2,
      receivedAt: iso,
    });
  });

  it("parses Format B", () => {
    expect(parseStatus(FORMAT_B, now)).toEqual({
      pzem: { voltage: 230.1, current: 1.5, frequency: 49.9, power: 340 },
      radar: { liquid: 3.2, airGap: 0.8 },
      float: { f1: true, f2: true, f3: false },
      wireBreak: { red: false, blue: true },
      devices: { pump: true, alarm: true, light: null, relay1: null, relay2: null },
      personCount: null,
      receivedAt: iso,
    });
  });

  it("zero is a reading, not missing", () => {
    const s = parseStatus({ radar: { liquid: 0, air: 0 } }, now)!;
    expect(s.radar.liquid).toBe(0);
    expect(s.radar.airGap).toBe(0);
  });

  it("missing field -> null", () => {
    const s = parseStatus({ pzem: { v: 230 } }, now)!;
    expect(s.pzem).toEqual({ voltage: 230, current: null, frequency: null, power: null });
    expect(s.radar).toEqual({ liquid: null, airGap: null });
    expect(s.float).toEqual({});
  });

  it("distance is not liquid", () => {
    const s = parseStatus({ stm32: { Radar: { distance: 2.5 } } }, now)!;
    expect(s.radar.airGap).toBe(2.5);
    expect(s.radar.liquid).toBeNull();
  });

  it("NaN / non-numeric strings -> null", () => {
    const s = parseStatus({ pzem: { v: NaN, i: "abc", p: Infinity, freq: "50" } }, now)!;
    expect(s.pzem.voltage).toBeNull();
    expect(s.pzem.current).toBeNull();
    expect(s.pzem.power).toBeNull();
    expect(s.pzem.frequency).toBe(50);
  });

  it.each([null, undefined, "x", 5, [], true])("non-object %j -> null", (v) => {
    expect(parseStatus(v, now)).toBeNull();
  });

  it("empty string is not a reading", () => {
    expect(parseStatus({ pzem: { v: "" } }, now)!.pzem.voltage).toBeNull();
  });
});
