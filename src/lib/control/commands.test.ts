import { describe, expect, it } from "vitest";
import { parseCommand } from "./commands";

const ALL = ["P1", "P0", "A1", "A0", "L1", "L0", "R1", "R0", "AUTO", "MANUAL", "OFF"];

describe("parseCommand", () => {
  it("trims and upper-cases", () => {
    expect(parseCommand("p1 ")).toBe("P1");
  });
  it.each(ALL)("round-trips %s", (c) => {
    expect(parseCommand(c)).toBe(c);
  });
  it("accepts mode words in any case", () => {
    expect(parseCommand("auto")).toBe("AUTO");
    expect(parseCommand(" Manual ")).toBe("MANUAL");
  });
  // WHY: M1/M0 and Q1/Q0 drive the master relays, which the STM32 binds to its mode —
  // gates are not remotely controllable, so this app rejects them outright.
  it.each(["M1", "M0", "Q1", "Q0"])("rejects gate command %j", (v) => {
    expect(parseCommand(v)).toBeNull();
  });
  it.each(["P2", "P", "P10", "", "S1", "P1;", "P\n1", "AUTOMATIC", "ON", "AUTO1"])("rejects %j", (v) => {
    expect(parseCommand(v)).toBeNull();
  });
  it.each([42, null, undefined, {}, ["P1"]])("rejects non-string %j", (v) => {
    expect(parseCommand(v)).toBeNull();
  });
});
