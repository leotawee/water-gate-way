import "server-only";
import { isGateId } from "@/lib/gates";
import { publish } from "@/lib/telemetry/broker";
import { commandTopicFor } from "@/lib/telemetry/topics";
import type { Command } from "./commands";

// Publishes one command through the server's own MQTT connection (the "nextjs" broker account,
// the only one allowed to write command topics). "sent" means the broker connection took the bytes;
// delivery to the cabinet is not confirmed, the status stream shows the effect.
// WHY: the cabinet's cmd_node expects the bare 2-character string (no JSON, no newline).
export async function forwardCommand(gateId: string, cmd: Command): Promise<"sent" | "failed"> {
  // WHY: commandTopicFor does not validate; an id with "/", "+" or "#" must never reach a topic string.
  if (!isGateId(gateId)) return "failed";
  try {
    // WHY: read at call time so the legacy stm32/cmd topic (gate-1 only) can be switched off without a rebuild.
    const topic = commandTopicFor(gateId, process.env.WGW_LEGACY_TOPICS !== "0");
    return (await publish(topic, cmd)) ? "sent" : "failed";
  } catch (e) {
    console.error("[control/forward] publish failed:", e instanceof Error ? e.message : "unknown");
    return "failed";
  }
}
