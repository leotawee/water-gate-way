import { describe, it, expect } from "vitest";
import { isTooFarBehind, lagSeconds, MAX_LAG_S } from "./liveLag";

describe("liveLag", () => {
  it("lagSeconds is wall time minus media time", () => {
    expect(lagSeconds(60, 55)).toBe(5);
  });
  it("slow startup alone never triggers (no reconnect loop)", () => {
    // 12 s to first frame through the proxy, then playing in sync
    expect(isTooFarBehind(12, 0, 12)).toBe(false);
    expect(isTooFarBehind(72, 60, 12)).toBe(false);
  });
  it("in sync after a normal start", () => {
    expect(isTooFarBehind(60, 55.6, 4.4)).toBe(false);
  });
  it("rebuffers adding more than MAX_LAG_S trigger", () => {
    expect(isTooFarBehind(60, 60 - 4.4 - MAX_LAG_S - 0.1, 4.4)).toBe(true);
  });
  it("exactly MAX_LAG_S of added lag does not trigger", () => {
    expect(isTooFarBehind(4.4 + MAX_LAG_S, 0, 4.4)).toBe(false);
  });
  it("a held-back start (blocked autoplay, measured 26 s + startup) triggers", () => {
    expect(isTooFarBehind(31, 0, 31)).toBe(true);
  });
});
