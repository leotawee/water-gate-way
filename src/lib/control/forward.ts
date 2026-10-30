import "server-only";
import { publish } from "@/lib/telemetry/broker";
import type { Command } from "./commands";

// WHY: the Pi's cmd_node subscribes to this topic and expects the bare 2-character string
// (no JSON, no newline), the same payload the old browser client published.
const COMMAND_TOPIC = "stm32/cmd";

// Publishes one command through the server's own MQTT connection (the "nextjs" broker account,
// the only one allowed to write COMMAND_TOPIC). "sent" means the broker connection took the bytes;
// delivery to the Pi is not confirmed, the status stream shows the effect.
export async function forwardCommand(cmd: Command): Promise<"sent" | "failed"> {
  try {
    return (await publish(COMMAND_TOPIC, cmd)) ? "sent" : "failed";
  } catch (e) {
    console.error("[control/forward] publish failed:", e instanceof Error ? e.message : "unknown");
    return "failed";
  }
}
