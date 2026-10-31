import { describe, it, expect } from "vitest";
import { CAMERAS } from "./gates";

describe("gates", () => {
  it("camera allowlist", () => {
    expect(CAMERAS).toEqual(["office1", "office2", "office3"]);
  });
});
