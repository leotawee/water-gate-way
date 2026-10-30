import { describe, it, expect } from "vitest";
import { GATES, CAMERAS, getGate } from "./gates";

describe("gates", () => {
  it("getGate finds gate-1 with a device", () => {
    expect(getGate("gate-1")).toMatchObject({ id: "gate-1", name: "Gate 1 - Nam Ping", hasDevice: true });
  });

  it("unknown or missing id -> null", () => {
    expect(getGate("nope")).toBeNull();
    expect(getGate(undefined)).toBeNull();
    expect(getGate("__proto__")).toBeNull();
  });

  it("five gates, only gate-1 has a device", () => {
    expect(GATES.map((g) => g.id)).toEqual(["gate-1", "gate-2", "gate-3", "gate-4", "gate-5"]);
    expect(GATES.filter((g) => g.hasDevice).map((g) => g.id)).toEqual(["gate-1"]);
  });

  it("camera allowlist", () => {
    expect(CAMERAS).toEqual(["office1", "office2", "office3"]);
  });
});
