import { describe, expect, it } from "vitest";
import { commandLabel } from "./DeviceSwitch";

describe("commandLabel", () => {
  it("…1 targets on → สั่งเปิด", () => {
    expect(commandLabel("P1")).toBe("สั่งเปิด");
    expect(commandLabel("A1")).toBe("สั่งเปิด");
    expect(commandLabel("L1")).toBe("สั่งเปิด");
    expect(commandLabel("R1")).toBe("สั่งเปิด");
    expect(commandLabel("Q1")).toBe("สั่งเปิด");
  });

  it("…0 targets off → สั่งปิด", () => {
    expect(commandLabel("P0")).toBe("สั่งปิด");
    expect(commandLabel("A0")).toBe("สั่งปิด");
    expect(commandLabel("L0")).toBe("สั่งปิด");
    expect(commandLabel("R0")).toBe("สั่งปิด");
    expect(commandLabel("Q0")).toBe("สั่งปิด");
  });
});
