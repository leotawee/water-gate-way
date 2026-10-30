import { describe, it, expect } from "vitest";
import { deviceBadge } from "./deviceBadge";

describe("deviceBadge", () => {
  it("stale -> — whatever the last value", () => {
    expect(deviceBadge(true, true)).toBe("—");
    expect(deviceBadge(false, true)).toBe("—");
    expect(deviceBadge(null, true)).toBe("—");
  });
  it("null -> —", () => expect(deviceBadge(null, false)).toBe("—"));
  it("true -> ON", () => expect(deviceBadge(true, false)).toBe("ON"));
  it("false -> OFF", () => expect(deviceBadge(false, false)).toBe("OFF"));
});
