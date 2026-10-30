import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("@/lib/telemetry/broker", () => ({ publish: h.publish }));

import { forwardCommand } from "./forward";
import { COMMANDS } from "./commands";

beforeEach(() => {
  h.publish.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("forwardCommand", () => {
  it.each(COMMANDS)("%s is published as the bare 2-character string on stm32/cmd -> sent", async (cmd) => {
    h.publish.mockResolvedValue(true);
    expect(await forwardCommand(cmd)).toBe("sent");
    // WHY: the Pi's cmd_node expects the raw string: no JSON, no newline, no spaces.
    expect(h.publish).toHaveBeenCalledExactlyOnceWith("stm32/cmd", cmd);
  });

  it("broker did not take the message -> failed", async () => {
    h.publish.mockResolvedValue(false);
    expect(await forwardCommand("P1")).toBe("failed");
  });

  it("publish throws -> failed, never rejects", async () => {
    h.publish.mockRejectedValue(new Error("boom"));
    expect(await forwardCommand("P1")).toBe("failed");
    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
