import { describe, expect, it } from "vitest";
import { deviceView } from "./deviceSwitchState";

describe("deviceView", () => {
  it("on -> 'on'", () => {
    expect(deviceView(true, false)).toBe("on");
  });

  it("off -> 'off'", () => {
    expect(deviceView(false, false)).toBe("off");
  });

  it("null state -> 'unknown'", () => {
    expect(deviceView(null, false)).toBe("unknown");
  });

  it("stale telemetry -> 'unknown' even when the last value is on or off", () => {
    expect(deviceView(true, true)).toBe("unknown");
    expect(deviceView(false, true)).toBe("unknown");
    expect(deviceView(null, true)).toBe("unknown");
  });
});
