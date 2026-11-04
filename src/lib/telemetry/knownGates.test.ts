import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const h = vi.hoisted(() => ({ listGates: vi.fn() }));

vi.mock("@/lib/gatesDb", () => ({ listGates: h.listGates }));

const rec = (id: string) => ({ id, name: id, location: "", lat: 0, lng: 0, hasDevice: true, active: true });

type Mod = typeof import("./knownGates");
async function load(): Promise<Mod> {
  vi.resetModules();
  delete (globalThis as { __wgKnownGates?: unknown }).__wgKnownGates;
  return import("./knownGates");
}

beforeEach(() => {
  h.listGates.mockReset();
  h.listGates.mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("knownGates", () => {
  it("gate-1 is known before any refresh; everything else is not (fail closed)", async () => {
    const { isKnownGate } = await load();
    expect(isKnownGate("gate-1")).toBe(true);
    expect(isKnownGate("gate-2")).toBe(false);
    expect(isKnownGate("gate-7777")).toBe(false);
  });

  it("ids from listGates are known after a refresh; unlisted ids stay unknown", async () => {
    h.listGates.mockResolvedValue([rec("gate-2"), rec("gate-3")]);
    const { isKnownGate, refreshKnownGates } = await load();
    await refreshKnownGates();
    expect(h.listGates).toHaveBeenCalledWith();
    expect(isKnownGate("gate-2")).toBe(true);
    expect(isKnownGate("gate-3")).toBe(true);
    expect(isKnownGate("gate-4")).toBe(false);
  });

  it("gate-1 stays known even when the registry does not list it", async () => {
    h.listGates.mockResolvedValue([rec("gate-2")]);
    const { isKnownGate, refreshKnownGates } = await load();
    await refreshKnownGates();
    expect(isKnownGate("gate-1")).toBe(true);
  });

  it("a failing refresh keeps the previous set and logs only the message", async () => {
    h.listGates.mockResolvedValueOnce([rec("gate-2")]);
    const { isKnownGate, refreshKnownGates } = await load();
    await refreshKnownGates();
    h.listGates.mockRejectedValueOnce(new Error("db down SECRETISH-ROW"));
    await expect(refreshKnownGates()).resolves.toBeUndefined();
    expect(isKnownGate("gate-2")).toBe(true);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("db down");
    expect(vi.mocked(console.error).mock.calls[0].every((a) => typeof a === "string")).toBe(true);
  });

  it("a failing first refresh leaves only gate-1 known", async () => {
    h.listGates.mockRejectedValue(new Error("db down"));
    const { isKnownGate, refreshKnownGates } = await load();
    await refreshKnownGates();
    expect(isKnownGate("gate-2")).toBe(false);
    expect(isKnownGate("gate-1")).toBe(true);
  });

  it("an id removed from the registry becomes unknown at the next refresh", async () => {
    h.listGates.mockResolvedValueOnce([rec("gate-2"), rec("gate-3")]).mockResolvedValueOnce([rec("gate-3")]);
    const { isKnownGate, refreshKnownGates } = await load();
    await refreshKnownGates();
    expect(isKnownGate("gate-2")).toBe(true);
    await refreshKnownGates();
    expect(isKnownGate("gate-2")).toBe(false);
    expect(isKnownGate("gate-3")).toBe(true);
  });

  it("startKnownGatesRefresh refreshes now, then every 60 s, once per process, with an unref'd timer", async () => {
    vi.useFakeTimers();
    const { startKnownGatesRefresh, isKnownGate } = await load();
    h.listGates.mockResolvedValue([rec("gate-2")]);
    startKnownGatesRefresh();
    startKnownGatesRefresh();
    expect(h.listGates).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(isKnownGate("gate-2")).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.listGates).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.listGates).toHaveBeenCalledTimes(3);
    const t = (globalThis as { __wgKnownGates?: { timer?: { hasRef?: () => boolean } } }).__wgKnownGates?.timer;
    expect(t?.hasRef?.()).toBe(false);
  });

  it("a second module instance (dev reload) does not stack another timer", async () => {
    vi.useFakeTimers();
    const a = await load();
    a.startKnownGatesRefresh();
    vi.resetModules();
    const b = await import("./knownGates");
    b.startKnownGatesRefresh();
    expect(vi.getTimerCount()).toBe(1);
  });
});
