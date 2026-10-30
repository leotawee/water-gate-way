import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

type FakeClient = EventEmitter & { subscribe: ReturnType<typeof vi.fn>; publish: ReturnType<typeof vi.fn>; opts: Record<string, unknown> };
const h = vi.hoisted(() => ({ clients: [] as FakeClient[] }));

vi.mock("mqtt", () => ({
  connect: vi.fn((_url: string, opts: Record<string, unknown>) => {
    const c = Object.assign(new EventEmitter(), { subscribe: vi.fn(), publish: vi.fn(), opts }) as FakeClient;
    h.clients.push(c);
    return c;
  }),
}));

import { publish } from "./broker";

const client = () => h.clients.at(-1)!;
/** Lets the broker report "connected" the way mqtt.js does. */
const connected = () => client().emit("connect");

beforeEach(() => {
  delete (globalThis as { __wgTelemetry?: unknown }).__wgTelemetry;
  h.clients.length = 0;
  vi.stubEnv("MQTT_URL", "mqtt://127.0.0.1:1883");
  vi.stubEnv("MQTT_USERNAME", "nextjs");
  vi.stubEnv("MQTT_PASSWORD", "pw-not-logged");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("publish", () => {
  it("sends the payload as-is at QoS 0 and resolves true when the write succeeds", async () => {
    publish("stm32/cmd", "P1").catch(() => {}); // creates the client
    connected();
    client().publish.mockImplementation((_t: string, _p: string, _o: unknown, cb: (e?: Error) => void) => cb());
    expect(await publish("stm32/cmd", "P1")).toBe(true);
    expect(client().publish).toHaveBeenCalledWith("stm32/cmd", "P1", { qos: 0 }, expect.any(Function));
  });

  it("does not queue messages while offline (a late pump command is worse than a failed one)", async () => {
    await publish("stm32/cmd", "P1");
    expect(client().opts).toMatchObject({ queueQoSZero: false });
  });

  it("resolves false without calling mqtt when the broker is not connected", async () => {
    expect(await publish("stm32/cmd", "P1")).toBe(false);
    expect(client().publish).not.toHaveBeenCalled();
  });

  it("resolves false after the broker connection drops", async () => {
    await publish("stm32/cmd", "P1");
    connected();
    client().emit("close");
    expect(await publish("stm32/cmd", "P1")).toBe(false);
    expect(client().publish).not.toHaveBeenCalled();
  });

  it("resolves false and logs only the error message when mqtt reports an error", async () => {
    await publish("stm32/cmd", "P1");
    connected();
    client().publish.mockImplementation((_t: string, _p: string, _o: unknown, cb: (e?: Error) => void) =>
      cb(new Error("No connection to broker"))
    );
    expect(await publish("stm32/cmd", "P1")).toBe(false);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("No connection to broker");
    expect(logged).not.toContain("pw-not-logged");
  });

  it("resolves false when the write callback never fires within 5 s", async () => {
    await publish("stm32/cmd", "P1");
    connected();
    vi.useFakeTimers();
    client().publish.mockImplementation(() => {}); // never calls back
    const pending = publish("stm32/cmd", "P1");
    await vi.advanceTimersByTimeAsync(4_999);
    let settled = false;
    pending.then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toBe(false);
  });

  it("resolves false when MQTT_URL is not set", async () => {
    vi.stubEnv("MQTT_URL", "");
    expect(await publish("stm32/cmd", "P1")).toBe(false);
    expect(h.clients).toHaveLength(0);
  });
});
