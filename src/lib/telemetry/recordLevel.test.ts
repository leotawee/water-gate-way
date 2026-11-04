import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { GateStatus } from "./parseStatus";
import { createLevelRecorder, sampleMs, DEFAULT_SAMPLE_SEC } from "./recordLevel";

const G1 = "gate-1";
const G2 = "gate-2";
const T0 = "2026-01-01T00:00:00.000Z";

const status = (liquid: number | null, receivedAt: string): GateStatus => ({
  mode: null,
  pzem: { voltage: null, current: null, frequency: null, power: null },
  radar: { liquid, airGap: null },
  float: {},
  wireBreak: { red: null, blue: null },
  devices: { pump: null, alarm: null, light: null, relay1: null, relay2: null, master1: null },
  personCount: null,
  receivedAt,
});

describe("sampleMs", () => {
  it("default is exported and equals 5 minutes", () => {
    expect(DEFAULT_SAMPLE_SEC).toBe(300);
  });

  it.each([
    [undefined, 300_000],
    ["", 300_000],
    ["abc", 300_000],
    ["0", 300_000],
    ["-5", 300_000],
    ["60", 60_000],
    ["999999", 86_400_000], // capped at 24 h
  ])("sampleMs(%p) -> %p", (raw, ms) => {
    expect(sampleMs(raw)).toBe(ms);
  });
});

describe("createLevelRecorder", () => {
  let insert: ReturnType<typeof vi.fn<(gateId: string, liquid: number, at: Date) => Promise<unknown>>>;

  beforeEach(() => {
    insert = vi.fn<(gateId: string, liquid: number, at: Date) => Promise<unknown>>(async () => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records the first valid sample with the receivedAt time, not the wall clock", async () => {
    const rec = createLevelRecorder(insert, 300_000);
    await rec(status(1.25, T0), G1);
    expect(insert).toHaveBeenCalledExactlyOnceWith(G1, 1.25, new Date(T0));
  });

  it("skips a second sample inside the window", async () => {
    const rec = createLevelRecorder(insert, 300_000);
    await rec(status(1, T0), G1);
    await rec(status(1.1, "2026-01-01T00:04:59.999Z"), G1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("records a sample exactly sampleMs after the last recorded one", async () => {
    const rec = createLevelRecorder(insert, 300_000);
    await rec(status(1, T0), G1);
    await rec(status(1.1, "2026-01-01T00:05:00.000Z"), G1);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it.each([null, NaN, Infinity])("ignores liquid %p", async (liquid) => {
    const rec = createLevelRecorder(insert, 300_000);
    await rec(status(liquid, T0), G1);
    expect(insert).not.toHaveBeenCalled();
  });

  it("ignores a receivedAt that does not parse", async () => {
    const rec = createLevelRecorder(insert, 300_000);
    await rec(status(1, "not a time"), G1);
    expect(insert).not.toHaveBeenCalled();
  });

  it("two concurrent calls in one window insert exactly once", async () => {
    let release!: () => void;
    insert.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    const rec = createLevelRecorder(insert, 300_000);
    const a = rec(status(1, T0), G1);
    const b = rec(status(1.1, T0), G1);
    release();
    await Promise.all([a, b]);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("a rejecting insert resolves, logs once without the payload, keeps the window, retries next window", async () => {
    insert.mockRejectedValueOnce(new Error("db down"));
    const rec = createLevelRecorder(insert, 300_000);
    await expect(rec(status(42.42, T0), G1)).resolves.toBeUndefined();
    expect(insert).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(vi.mocked(console.error).mock.calls);
    expect(logged).toContain("db down");
    expect(logged).not.toContain("42.42");
    // window stays claimed: no retry (and no hot loop) inside the window
    insert.mockResolvedValue(undefined);
    await rec(status(1.1, "2026-01-01T00:01:00.000Z"), G1);
    expect(insert).toHaveBeenCalledTimes(1);
    // next window tries again
    await rec(status(1.2, "2026-01-01T00:05:00.000Z"), G1);
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it("the same status delivered twice for one gate inside a window inserts once (dual-publish)", async () => {
    const rec = createLevelRecorder(insert, 300_000);
    await rec(status(1, T0), G1);
    await rec(status(1, T0), G1);
    expect(insert).toHaveBeenCalledTimes(1);
  });

  it("two gates at the same instant insert separately, each with its gate id", async () => {
    const rec = createLevelRecorder(insert, 300_000);
    await rec(status(1, T0), G1);
    await rec(status(2, T0), G2);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenNthCalledWith(1, G1, 1, new Date(T0));
    expect(insert).toHaveBeenNthCalledWith(2, G2, 2, new Date(T0));
  });

  it("a failed insert for gate-2 does not block gate-1", async () => {
    insert.mockImplementation(async (gateId) => {
      if (gateId === G2) throw new Error("db down");
    });
    const rec = createLevelRecorder(insert, 300_000);
    await expect(rec(status(2, T0), G2)).resolves.toBeUndefined();
    await rec(status(1, T0), G1);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenLastCalledWith(G1, 1, new Date(T0));
  });
});
