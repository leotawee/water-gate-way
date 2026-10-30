import { describe, expect, it } from "vitest";
import { parseCommand } from "./commands";

const ALL = ["P1", "P0", "A1", "A0", "L1", "L0", "M1", "M0", "R1", "R0", "Q1", "Q0"];

describe("parseCommand", () => {
  it("trims and upper-cases", () => {
    expect(parseCommand("p1 ")).toBe("P1");
  });
  it.each(ALL)("round-trips %s", (c) => {
    expect(parseCommand(c)).toBe(c);
  });
  it.each(["P2", "P", "P10", "", "S1", "P1;", "P\n1"])("rejects %j", (v) => {
    expect(parseCommand(v)).toBeNull();
  });
  it.each([42, null, undefined, {}, ["P1"]])("rejects non-string %j", (v) => {
    expect(parseCommand(v)).toBeNull();
  });
});
