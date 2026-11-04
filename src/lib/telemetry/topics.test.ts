import { describe, it, expect } from "vitest";
import { parseTelemetryTopic, commandTopicFor } from "./topics";

describe("parseTelemetryTopic", () => {
  it.each([
    ["stm32/status/all", { gateId: "gate-1", kind: "status" }],
    ["water/gate/person", { gateId: "gate-1", kind: "person" }],
    ["gate/gate-2/status", { gateId: "gate-2", kind: "status" }],
    ["gate/gate-2/person", { gateId: "gate-2", kind: "person" }],
  ])("parses %s", (topic, want) => {
    expect(parseTelemetryTopic(topic)).toEqual(want);
  });

  it.each([
    "gate/gate-1/status/extra",
    "gate/GATE-1/status",
    "gate/../status",
    "gate/+/status",
    "gate/gate-1/cmd",
    "gate/gate-1/",
    "stm32/cmd",
    "",
  ])("rejects %j", (topic) => {
    expect(parseTelemetryTopic(topic)).toBeNull();
  });
});

describe("commandTopicFor", () => {
  it("uses the legacy topic only for gate-1 in legacy mode", () => {
    expect(commandTopicFor("gate-1", true)).toBe("stm32/cmd");
    expect(commandTopicFor("gate-1", false)).toBe("gate/gate-1/cmd");
    expect(commandTopicFor("gate-2", true)).toBe("gate/gate-2/cmd");
  });
});
