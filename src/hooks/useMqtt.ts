import { useEffect, useRef, useState, useCallback } from "react";

// Use the browser ESM build to avoid Node.js 'net' polyfill issues.
// @ts-expect-error mqtt/dist/mqtt.esm has no typings but is the correct browser build
import mqtt from "mqtt/dist/mqtt.esm";
import type { MqttClient, IClientOptions } from "mqtt";

/* ── MQTT Broker config ── */
// WHY: literal process.env access is required so Next inlines it at build time
const MQTT_BROKER_URL = process.env.NEXT_PUBLIC_MQTT_URL;

export const TOPIC_CONTROL = "stm32/cmd";
export const TOPIC_STATUS = "stm32/status/all";

export type MqttConnState = "connecting" | "connected" | "disconnected" | "error";

/**
 * React hook that manages an MQTT-over-WebSocket connection.
 *
 * Uses mqtt/dist/mqtt.esm (browser build) so it works inside
 * Next.js / Turbopack without pulling Node.js 'net' modules.
 */
export function useMqtt() {
  // WHY: initial state derived here, not set inside the effect (react-hooks/set-state-in-effect)
  const [connState, setConnState] = useState<MqttConnState>(
    MQTT_BROKER_URL ? "connecting" : "error"
  );
  const [statusData, setStatusData] = useState<Record<string, unknown> | null>(
    null
  );
  const clientRef = useRef<MqttClient | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!MQTT_BROKER_URL) {
      console.error("[MQTT] NEXT_PUBLIC_MQTT_URL is not set");
      return;
    }

    console.log(`[MQTT] Connecting to ${MQTT_BROKER_URL} ...`);
    setConnState("connecting");

    // WHY: no `protocol` here; mqtt.js takes the scheme from the URL (ws:// or wss://)
    const options: IClientOptions = {
      reconnectPeriod: 3000,   // auto-reconnect every 3s
      connectTimeout: 10_000,  // 10s initial timeout
      clean: true,
      clientId: `watergate_web_${Math.random().toString(36).slice(2, 8)}`,
    };

    const client: MqttClient = mqtt.connect(MQTT_BROKER_URL, options);
    clientRef.current = client;

    client.on("connect", () => {
      if (cancelled) {
        client.end(true);
        return;
      }
      console.log("[MQTT] ✅ Connected to Broker");
      setConnState("connected");
      client.subscribe(TOPIC_STATUS, (err: Error | null) => {
        if (err) console.error("[MQTT] Subscribe error:", err);
        else console.log(`[MQTT] Subscribed -> ${TOPIC_STATUS}`);
      });
    });

    client.on("message", (topic: string, payload: Buffer) => {
      if (topic === TOPIC_STATUS) {
        try {
          const data = JSON.parse(payload.toString());
          setStatusData(data);
        } catch {
          console.warn("[MQTT] Invalid JSON:", payload.toString());
        }
      }
    });

    client.on("error", (err: Error) => {
      console.error("[MQTT] ❌ Error:", err.message);
      setConnState("error");
    });

    client.on("offline", () => {
      console.warn("[MQTT] ⚠️ Offline");
      setConnState("disconnected");
    });

    client.on("reconnect", () => {
      console.log("[MQTT] 🔄 Reconnecting...");
      setConnState("connecting");
    });

    client.on("close", () => {
      if (!cancelled) setConnState("disconnected");
    });

    return () => {
      cancelled = true;
      client.end(true);
      console.log("[MQTT] Disposed");
    };
  }, []);

  const publish = useCallback(
    (command: string): boolean => {
      const client = clientRef.current;
      if (!client || !client.connected) {
        console.warn("[MQTT TX] Cannot publish — not connected");
        return false;
      }

      // ── Clean & validate ──
      const clean = command.trim().toUpperCase();
      if (clean.length !== 2) {
        console.warn(`[MQTT TX REJECTED] length=${clean.length}: "${clean}"`);
        return false;
      }
      const validCmds = new Set([
        "P1", "P0", "A1", "A0", "L1", "L0", "M1", "M0",
        "R1", "R0", "Q1", "Q0",
      ]);
      if (!validCmds.has(clean)) {
        console.warn(`[MQTT TX REJECTED] unknown cmd: "${clean}"`);
        return false;
      }

      // Publish RAW string — no JSON, no newline, no spaces
      client.publish(TOPIC_CONTROL, clean, { qos: 0 });
      console.log(`[MQTT TX] ✅ "${clean}" -> ${TOPIC_CONTROL}`);
      return true;
    },
    []
  );

  return {
    connState,
    connected: connState === "connected",
    statusData,
    publish,
  };
}
