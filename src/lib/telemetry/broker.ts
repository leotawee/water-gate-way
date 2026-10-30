import "server-only";
import { connect, type MqttClient } from "mqtt";
import { parseStatus, type GateStatus } from "./parseStatus";

export type ConnState = "connected" | "disconnected";
export type StatusEvent = { type: "status"; status: GateStatus } | { type: "conn"; state: ConnState };
type Listener = (e: StatusEvent) => void;

type State = {
  client: MqttClient | null;
  conn: ConnState;
  last: GateStatus | null;
  listeners: Set<Listener>;
  lastWarn: number;
};

const DEFAULT_TOPIC = "stm32/status/all";
const MAX_PAYLOAD = 64 * 1024;
const WARN_EVERY_MS = 60_000;

// WHY: globalThis survives Next dev hot reloads, so one broker connection per process, not per reload.
const g = globalThis as typeof globalThis & { __wgTelemetry?: State };

function emit(s: State, e: StatusEvent) {
  for (const l of s.listeners) {
    try {
      l(e);
    } catch (err) {
      console.error("[telemetry] listener failed:", err instanceof Error ? err.message : "unknown");
    }
  }
}

function setConn(s: State, conn: ConnState) {
  if (s.conn === conn) return;
  s.conn = conn;
  emit(s, { type: "conn", state: conn });
}

// WHY: never echo the payload; it is untrusted and may be large.
function warnBadPayload(s: State, topic: string) {
  const now = Date.now();
  if (now - s.lastWarn < WARN_EVERY_MS) return;
  s.lastWarn = now;
  console.warn(`[telemetry] dropped unparseable message on ${topic}`);
}

function start(s: State) {
  const url = process.env.MQTT_URL;
  if (!url) {
    console.error("[telemetry] MQTT_URL is not set; telemetry stream stays disconnected");
    return;
  }
  const client = connect(url, {
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 5_000,
  });
  s.client = client;

  const extra = process.env.MQTT_TOPIC_STATUS;
  const topics = extra && extra !== DEFAULT_TOPIC ? [DEFAULT_TOPIC, extra] : [DEFAULT_TOPIC];

  client.on("connect", () => {
    setConn(s, "connected");
    // WHY: subscribe on every connect; a clean session after reconnect drops subscriptions.
    client.subscribe(topics, (err) => {
      if (err) console.error("[telemetry] subscribe failed:", err.message);
    });
  });
  client.on("offline", () => setConn(s, "disconnected"));
  client.on("close", () => setConn(s, "disconnected"));
  client.on("error", (err) => {
    console.error("[telemetry] mqtt error:", err.message);
    setConn(s, "disconnected");
  });
  client.on("message", (topic, payload) => {
    let status: GateStatus | null = null;
    if (payload.length <= MAX_PAYLOAD) {
      try {
        status = parseStatus(JSON.parse(payload.toString("utf8")), new Date());
      } catch {
        status = null;
      }
    }
    if (!status) return warnBadPayload(s, topic);
    s.last = status;
    emit(s, { type: "status", status });
  });
}

function state(): State {
  if (!g.__wgTelemetry) {
    const s: State = { client: null, conn: "disconnected", last: null, listeners: new Set(), lastWarn: -Infinity };
    g.__wgTelemetry = s;
    start(s);
  }
  return g.__wgTelemetry;
}

/** Listener gets the current conn state (and last status, if any) immediately, then live events. */
export function subscribeStatus(listener: Listener): () => void {
  const s = state();
  s.listeners.add(listener);
  try {
    listener({ type: "conn", state: s.conn });
    if (s.last) listener({ type: "status", status: s.last });
  } catch (err) {
    console.error("[telemetry] listener failed:", err instanceof Error ? err.message : "unknown");
  }
  return () => {
    s.listeners.delete(listener);
  };
}
