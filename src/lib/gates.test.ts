import { describe, it, expect } from "vitest";
import { CAMERAS, isGateId } from "./gates";

describe("gates", () => {
  it("camera allowlist", () => {
    expect(CAMERAS).toEqual(["office1", "office2", "office3"]);
  });
});

describe("isGateId", () => {
  it.each(["gate-1", "gate-1234"])("accepts %s", (v) => {
    expect(isGateId(v)).toBe(true);
  });
  it.each(["gate-0a", "gate-12345", "GATE-1", "gate-", "", 42, null])("rejects %s", (v) => {
    expect(isGateId(v)).toBe(false);
  });
});
