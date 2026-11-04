import { describe, expect, it } from "vitest";
import { parseStatus } from "./parseStatus";
import { FORMAT_A, FORMAT_B, LIVE_B } from "./fixtures";

const now = new Date("2026-10-30T07:00:01.000Z");
const iso = now.toISOString();

describe("parseStatus", () => {
  it("parses Format A", () => {
    expect(parseStatus(FORMAT_A, now)).toEqual({
      pzem: { voltage: 229.8, current: 1.42, frequency: 50, power: 321.5 },
      radar: { liquid: null, airGap: 1.85 },
      float: { f1: true, f2: false },
      wireBreak: { red: true, blue: null },
      devices: { pump: true, alarm: false, light: null, relay1: null, relay2: null, master1: null },
      mode: null,
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
      devices: { pump: true, alarm: true, light: null, relay1: null, relay2: null, master1: null },
      mode: null,
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

  it("parses the live Format B capture", () => {
    const s = parseStatus(LIVE_B, now)!;
    expect(s.mode).toBe("MANUAL");
    expect(s.devices.pump).toBe(false);
    expect(s.devices.relay1).toBe(false);
    expect(s.devices.relay2).toBe(true);
    expect(s.devices.master1).toBe(true);
    expect(s.devices.alarm).toBe(false);
    expect(s.radar.liquid).toBe(2.236);
  });

  it("keeps the three phases (R, S, T) from the live payload, zeros included", () => {
    const ph = parseStatus(LIVE_B, now)!.pzem.phases!;
    expect(ph).toHaveLength(3);
    expect(ph[0]).toEqual({ voltage: 225.5, current: 0, power: 0, energy: 0 });
    expect(ph[1].voltage).toBe(0);
    expect(parseStatus({ pzem: { v: 1 } }, now)!.pzem.phases).toBeUndefined();
  });

  it("power is the sum of the phases when there is no top-level p; a real 0 W stays 0", () => {
    expect(parseStatus({ pzem: { phases: [{ p: 100.5 }, { p: 20 }, { p: 0 }] } }, now)!.pzem.power).toBe(120.5);
    expect(parseStatus(LIVE_B, now)!.pzem.power).toBe(0);
    expect(parseStatus({ pzem: { p: 340, phases: [{ p: 1 }] } }, now)!.pzem.power).toBe(340);
    expect(parseStatus({ pzem: { phases: [] } }, now)!.pzem.power).toBeNull();
  });

  it.each([
    ["auto", "AUTO"],
    [" Manual ", "MANUAL"],
  ] as const)("mode %j normalises to %j", (raw, want) => {
    expect(parseStatus({ mode: raw }, now)!.mode).toBe(want);
  });

  it.each(["BOGUS", 5, undefined] as const)("mode %j -> null", (raw) => {
    expect(parseStatus({ mode: raw }, now)!.mode).toBeNull();
  });

  it("legacy boolean pump / alarm still parsed", () => {
    const s = parseStatus({ pump: true, alarm: true }, now)!;
    expect(s.devices.pump).toBe(true);
    expect(s.devices.alarm).toBe(true);
    expect(s.devices.relay1).toBeNull();
    expect(s.devices.relay2).toBeNull();
  });

  it("pump object with garbage pc0 -> null", () => {
    expect(parseStatus({ pump: { pc0: "x" } }, now)!.devices.pump).toBeNull();
  });

  it("Format A has no mode", () => {
    expect(parseStatus(FORMAT_A, now)!.mode).toBeNull();
  });
});
