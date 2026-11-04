import "server-only";
import { connect, type MqttClient } from "mqtt";
import { parseStatus, type GateStatus } from "./parseStatus";
import { recordLevel } from "./recordLevel";
import { LEGACY_GATE } from "./topics";

export type ConnState = "connected" | "disconnected";
export type StatusEvent = { type: "status"; status: GateStatus } | { type: "conn"; state: ConnState };
type Listener = (e: StatusEvent) => void;

type State = {
  client: MqttClient | null;
  conn: ConnState;
  last: GateStatus | null;
  listeners: Set<Listener>;
  lastWarn: number;
  /** Latest person count from the detector and when it arrived (ms); never part of `last`'s freshness. */
  person: { n: number; at: number } | null;
};

const DEFAULT_TOPIC = "stm32/status/all";
// WHY: the Pi's YOLO person detector publishes its debounced count here instead of riding
// stm32/status/all, so it can never overwrite the real device status (messages replace s.last).
const PERSON_TOPIC = "water/gate/person";
const MAX_PAYLOAD = 64 * 1024;
// A detector count older than this is not shown (the detector may have died; the STM32 status keeps flowing).
const PERSON_MAX_AGE_MS = 30_000;
const WARN_EVERY_MS = 60_000;
const PUBLISH_TIMEOUT_MS = 5_000;

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
// WHY not recordLevel here: person messages can arrive every few seconds; recording the merged
// status would duplicate water-level rows between real radar readings. Detection only mutates
// personCount, never the level source.
function personCountFrom(payload: Buffer): number | null {
  if (payload.length > MAX_PAYLOAD) return null;
  try {
    const o: unknown = JSON.parse(payload.toString("utf8"));
    if (typeof o !== "object" || o === null || Array.isArray(o)) return null;
    const v = (o as { person_count?: unknown }).person_count;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return null;
  } catch {
    return null;
  }
}

function applyPerson(s: State, payload: Buffer) {
  const n = personCountFrom(payload);
  if (n === null) return;
  s.person = { n, at: Date.now() };
  // WHY: no status yet -> nothing to show; the count is merged into the first real status.
  if (!s.last) return;
  // WHY: receivedAt is deliberately NOT touched. It means "when the STM32 last reported", and isStale()
  // trusts it; a detector message must never make a dead device look fresh.
  const merged = { ...s.last, personCount: n };
  s.last = merged;
  emit(s, { type: "status", status: merged });
}

/** A real status carries no person count; add the detector's latest while it is still fresh. */
function withPerson(s: State, status: GateStatus): GateStatus {
  if (status.personCount !== null || !s.person) return status;
  return Date.now() - s.person.at <= PERSON_MAX_AGE_MS ? { ...status, personCount: s.person.n } : status;
}

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
    // WHY: publish() must fail while offline, not queue and deliver a stale pump command after a reconnect.
    queueQoSZero: false,
  });
  s.client = client;

  const extra = process.env.MQTT_TOPIC_STATUS;
  const topics = [...new Set([DEFAULT_TOPIC, PERSON_TOPIC, ...(extra && extra !== DEFAULT_TOPIC ? [extra] : [])])];

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
    if (topic === PERSON_TOPIC) return applyPerson(s, payload);
    let status: GateStatus | null = null;
    if (payload.length <= MAX_PAYLOAD) {
      try {
        status = parseStatus(JSON.parse(payload.toString("utf8")), new Date());
      } catch {
        status = null;
      }
    }
    if (!status) return warnBadPayload(s, topic);
    status = withPerson(s, status);
    s.last = status;
    void recordLevel(status, LEGACY_GATE);
    emit(s, { type: "status", status });
  });
}

// WHY: the connection must start at server boot, not on the first visitor, or nothing is recorded while nobody has the dashboard open.
export function startTelemetry(): void {
  state();
}

function state(): State {
  if (!g.__wgTelemetry) {
    const s: State = { client: null, conn: "disconnected", last: null, listeners: new Set(), lastWarn: -Infinity, person: null };
    g.__wgTelemetry = s;
    start(s);
  }
  return g.__wgTelemetry;
}

/**
 * Publishes through the same connection as the status subscriber. Resolves true once mqtt.js has
 * written the message to the broker connection; false when the broker is not connected, mqtt.js
 * reports an error, or nothing happens within 5 s. QoS 0: at most once, never retried or replayed.
 * Delivery to the subscriber is not confirmed; the status stream shows the effect.
 */
export function publish(topic: string, payload: string): Promise<boolean> {
  const s = state();
  const client = s.client;
  if (!client || s.conn !== "connected") return Promise.resolve(false);
  return new Promise((resolve) => {
    // shortcut: a callback arriving after the timeout is ignored (promise already settled), so a
    // slow write may report "failed" for a command that went out; acceptable, commands are idempotent.
    const timer = setTimeout(() => resolve(false), PUBLISH_TIMEOUT_MS);
    client.publish(topic, payload, { qos: 0 }, (err) => {
      clearTimeout(timer);
      if (err) console.error("[telemetry] publish failed:", err.message);
      resolve(!err);
    });
  });
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
