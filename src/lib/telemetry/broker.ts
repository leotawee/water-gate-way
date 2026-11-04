import "server-only";
import { connect, type MqttClient } from "mqtt";
import { parseStatus, type GateStatus } from "./parseStatus";
import { recordLevel } from "./recordLevel";
import { LEGACY_GATE, LEGACY_PERSON_TOPIC, LEGACY_STATUS_TOPIC, PERSON_FILTER, STATUS_FILTER, parseTelemetryTopic, type TopicKind } from "./topics";

export type ConnState = "connected" | "disconnected";
export type StatusEvent = { type: "status"; status: GateStatus } | { type: "conn"; state: ConnState };
type Listener = (e: StatusEvent) => void;

type State = {
  client: MqttClient | null;
  conn: ConnState;
  /** Last real status per gate id; ids only ever come from parseTelemetryTopic. */
  last: Map<string, GateStatus>;
  listeners: Map<string, Set<Listener>>;
  lastWarn: number;
  /** Latest person count per gate from the detector and when it arrived (ms); never part of `last`'s freshness. */
  person: Map<string, { n: number; at: number }>;
};

// WHY: the Pi's YOLO person detector publishes its debounced count on a person topic instead of riding
// the status topic, so it can never overwrite the real device status (messages replace s.last[gate]).
const MAX_PAYLOAD = 64 * 1024;
// A detector count older than this is not shown (the detector may have died; the STM32 status keeps flowing).
const PERSON_MAX_AGE_MS = 30_000;
const WARN_EVERY_MS = 60_000;
const PUBLISH_TIMEOUT_MS = 5_000;

// WHY: globalThis survives Next dev hot reloads, so one broker connection per process, not per reload.
const g = globalThis as typeof globalThis & { __wgTelemetry?: State };

function call(l: Listener, e: StatusEvent) {
  try {
    l(e);
  } catch (err) {
    console.error("[telemetry] listener failed:", err instanceof Error ? err.message : "unknown");
  }
}

function emitGate(s: State, gateId: string, e: StatusEvent) {
  for (const l of s.listeners.get(gateId) ?? []) call(l, e);
}

function setConn(s: State, conn: ConnState) {
  if (s.conn === conn) return;
  s.conn = conn;
  // WHY: the broker link is shared by all cabinets, so connection events reach every listener.
  for (const set of s.listeners.values()) for (const l of set) call(l, { type: "conn", state: conn });
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

function applyPerson(s: State, gateId: string, payload: Buffer) {
  const n = personCountFrom(payload);
  if (n === null) return;
  s.person.set(gateId, { n, at: Date.now() });
  const last = s.last.get(gateId);
  // WHY: no status yet -> nothing to show; the count is merged into the first real status.
  if (!last) return;
  // WHY: receivedAt is deliberately NOT touched. It means "when the STM32 last reported", and isStale()
  // trusts it; a detector message must never make a dead device look fresh.
  const merged = { ...last, personCount: n };
  s.last.set(gateId, merged);
  emitGate(s, gateId, { type: "status", status: merged });
}

/** A real status carries no person count; add the detector's latest for this gate while it is still fresh. */
function withPerson(s: State, gateId: string, status: GateStatus): GateStatus {
  const p = s.person.get(gateId);
  if (status.personCount !== null || !p) return status;
  return Date.now() - p.at <= PERSON_MAX_AGE_MS ? { ...status, personCount: p.n } : status;
}

// WHY: the topic text is broker-supplied; only the fixed label is logged for topics we could not route.
function warnBadPayload(s: State, topic: string | null) {
  const now = Date.now();
  if (now - s.lastWarn < WARN_EVERY_MS) return;
  s.lastWarn = now;
  console.warn(`[telemetry] dropped unparseable message on ${topic ?? "an unrecognised topic"}`);
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
  const topics = [
    ...new Set([
      LEGACY_STATUS_TOPIC,
      LEGACY_PERSON_TOPIC,
      STATUS_FILTER,
      PERSON_FILTER,
      ...(extra && extra !== LEGACY_STATUS_TOPIC ? [extra] : []),
    ]),
  ];
  // WHY: the gate id comes from the topic, never the payload. The extra env topic is a legacy status topic of gate-1.
  const route = (topic: string): { gateId: string; kind: TopicKind } | null =>
    parseTelemetryTopic(topic) ?? (extra && topic === extra ? { gateId: LEGACY_GATE, kind: "status" } : null);

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
    const r = route(topic);
    if (!r) return warnBadPayload(s, null);
    const { gateId } = r;
    if (r.kind === "person") return applyPerson(s, gateId, payload);
    let status: GateStatus | null = null;
    if (payload.length <= MAX_PAYLOAD) {
      try {
        status = parseStatus(JSON.parse(payload.toString("utf8")), new Date());
      } catch {
        status = null;
      }
    }
    if (!status) return warnBadPayload(s, topic);
    status = withPerson(s, gateId, status);
    s.last.set(gateId, status);
    void recordLevel(status, gateId);
    emitGate(s, gateId, { type: "status", status });
  });
}

// WHY: the connection must start at server boot, not on the first visitor, or nothing is recorded while nobody has the dashboard open.
export function startTelemetry(): void {
  state();
}

function state(): State {
  if (!g.__wgTelemetry) {
    const s: State = { client: null, conn: "disconnected", listeners: new Map(), lastWarn: -Infinity, person: new Map(), last: new Map() };
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

/** Listener gets the current conn state (and this gate's last status, if any) immediately, then that gate's live events. */
export function subscribeStatus(gateId: string, listener: Listener): () => void {
  const s = state();
  let set = s.listeners.get(gateId);
  if (!set) s.listeners.set(gateId, (set = new Set()));
  set.add(listener);
  try {
    listener({ type: "conn", state: s.conn });
    const last = s.last.get(gateId);
    if (last) listener({ type: "status", status: last });
  } catch (err) {
    console.error("[telemetry] listener failed:", err instanceof Error ? err.message : "unknown");
  }
  return () => {
    set.delete(listener);
    if (set.size === 0 && s.listeners.get(gateId) === set) s.listeners.delete(gateId);
  };
}
