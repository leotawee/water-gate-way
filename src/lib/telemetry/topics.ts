import { isGateId } from "@/lib/gates";

// WHY: the first cabinet publishes on pre-multi-cabinet topics; they map to gate-1 until its firmware moves.
export const LEGACY_GATE = "gate-1";
export const LEGACY_STATUS_TOPIC = "stm32/status/all";
export const LEGACY_PERSON_TOPIC = "water/gate/person";
export const LEGACY_CMD_TOPIC = "stm32/cmd";
export const STATUS_FILTER = "gate/+/status";
export const PERSON_FILTER = "gate/+/person";

export type TopicKind = "status" | "person";

/** The gate id comes from the topic only, never from a payload. */
export function parseTelemetryTopic(topic: string): { gateId: string; kind: TopicKind } | null {
  if (topic === LEGACY_STATUS_TOPIC) return { gateId: LEGACY_GATE, kind: "status" };
  if (topic === LEGACY_PERSON_TOPIC) return { gateId: LEGACY_GATE, kind: "person" };
  const parts = topic.split("/");
  if (parts.length !== 3 || parts[0] !== "gate" || !isGateId(parts[1])) return null;
  if (parts[2] !== "status" && parts[2] !== "person") return null;
  return { gateId: parts[1], kind: parts[2] };
}

export function commandTopicFor(gateId: string, legacy: boolean): string {
  return legacy && gateId === LEGACY_GATE ? LEGACY_CMD_TOPIC : `gate/${gateId}/cmd`;
}
