import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ publish: vi.fn() }));
vi.mock("@/lib/telemetry/broker", () => ({ publish: h.publish }));

import { forwardCommand } from "./forward";
import { COMMANDS } from "./commands";

beforeEach(() => {
  h.publish.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.unstubAllEnvs();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("forwardCommand", () => {
  it.each(COMMANDS)("%s is published as the bare 2-character string on stm32/cmd -> sent", async (cmd) => {
    h.publish.mockResolvedValue(true);
    expect(await forwardCommand("gate-1", cmd)).toBe("sent");
    // WHY: the Pi's cmd_node expects the raw string: no JSON, no newline, no spaces.
    expect(h.publish).toHaveBeenCalledExactlyOnceWith("stm32/cmd", cmd);
  });

  it("broker did not take the message -> failed", async () => {
    h.publish.mockResolvedValue(false);
    expect(await forwardCommand("gate-1", "P1")).toBe("failed");
  });

  it("publish throws -> failed, never rejects", async () => {
    h.publish.mockRejectedValue(new Error("boom"));
    expect(await forwardCommand("gate-1", "P1")).toBe("failed");
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("gate-1 with WGW_LEGACY_TOPICS=0 -> gate/gate-1/cmd", async () => {
    vi.stubEnv("WGW_LEGACY_TOPICS", "0");
    h.publish.mockResolvedValue(true);
    expect(await forwardCommand("gate-1", "R1")).toBe("sent");
    expect(h.publish).toHaveBeenCalledExactlyOnceWith("gate/gate-1/cmd", "R1");
  });

  it.each([undefined, "1"])("gate-2 with WGW_LEGACY_TOPICS=%s -> gate/gate-2/cmd, never the legacy topic", async (v) => {
    if (v !== undefined) vi.stubEnv("WGW_LEGACY_TOPICS", v);
    h.publish.mockResolvedValue(true);
    expect(await forwardCommand("gate-2", "R1")).toBe("sent");
    expect(h.publish).toHaveBeenCalledExactlyOnceWith("gate/gate-2/cmd", "R1");
  });

  it("gate-2 with WGW_LEGACY_TOPICS=0 -> gate/gate-2/cmd", async () => {
    vi.stubEnv("WGW_LEGACY_TOPICS", "0");
    h.publish.mockResolvedValue(true);
    await forwardCommand("gate-2", "R1");
    expect(h.publish).toHaveBeenCalledExactlyOnceWith("gate/gate-2/cmd", "R1");
  });

  it.each(["", "gate-", "gate-12345", "gate-1/../x", "gate/+", "#", "stm32", "GATE-1", "gate-1\n"])(
    "malformed gate id %j -> failed, nothing published",
    async (id) => {
      expect(await forwardCommand(id, "R1")).toBe("failed");
      expect(h.publish).not.toHaveBeenCalled();
    },
  );
});
