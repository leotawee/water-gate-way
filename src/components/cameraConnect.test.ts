import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ICE_CAP_MS,
  ICE_SETTLE_MS,
  MSE_PREFERRED_TTL_MS,
  connectTimeoutMs,
  maxFailures,
  preferredTransport,
  rememberMse,
  waitForIceCandidates,
} from "./cameraConnect";

class FakePc extends EventTarget {
  iceGatheringState: RTCIceGatheringState = "new";
  setState(s: RTCIceGatheringState) {
    this.iceGatheringState = s;
    this.dispatchEvent(new Event("icegatheringstatechange"));
  }
  candidate(line: string) {
    this.dispatchEvent(Object.assign(new Event("icecandidate"), { candidate: { candidate: line } }));
  }
}
const HOST = "candidate:1 1 udp 2122260223 192.168.1.5 50000 typ host generation 0";
const SRFLX = "candidate:2 1 udp 1686052607 203.0.113.9 50001 typ srflx raddr 192.168.1.5 rport 50000";

describe("waitForIceCandidates", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const track = (pc: FakePc) => {
    const state = { done: false };
    void waitForIceCandidates(pc as unknown as RTCPeerConnection).then(() => (state.done = true));
    return state;
  };

  // REGRESSION: the non-trickle offer was sent with 0 candidates because the first
  // `icegatheringstatechange` ("gathering") resolved the wait.
  it("does not resolve just because gathering started", async () => {
    const pc = new FakePc();
    const s = track(pc);
    pc.setState("gathering");
    await vi.advanceTimersByTimeAsync(ICE_SETTLE_MS * 2);
    expect(s.done).toBe(false);
  });

  it("resolves ICE_SETTLE_MS after the first srflx candidate", async () => {
    const pc = new FakePc();
    const s = track(pc);
    pc.setState("gathering");
    pc.candidate(HOST);
    await vi.advanceTimersByTimeAsync(ICE_SETTLE_MS * 2);
    expect(s.done).toBe(false); // host candidates alone are not enough
    pc.candidate(SRFLX);
    await vi.advanceTimersByTimeAsync(ICE_SETTLE_MS - 1);
    expect(s.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(s.done).toBe(true);
  });

  it("gives up at ICE_CAP_MS when STUN never answers (host-only offer)", async () => {
    const pc = new FakePc();
    const s = track(pc);
    pc.setState("gathering");
    pc.candidate(HOST);
    await vi.advanceTimersByTimeAsync(ICE_CAP_MS - 1);
    expect(s.done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(s.done).toBe(true);
  });

  it("resolves at once when gathering completes", async () => {
    const pc = new FakePc();
    const s = track(pc);
    pc.setState("complete");
    await vi.advanceTimersByTimeAsync(0);
    expect(s.done).toBe(true);
  });

  it("resolves at once when gathering is already complete", async () => {
    const pc = new FakePc();
    pc.iceGatheringState = "complete";
    const s = track(pc);
    await vi.advanceTimersByTimeAsync(0);
    expect(s.done).toBe(true);
  });

  it("leaves no timers behind", async () => {
    const pc = new FakePc();
    track(pc);
    pc.candidate(SRFLX);
    await vi.advanceTimersByTimeAsync(ICE_SETTLE_MS);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("transport policy", () => {
  it("falls back to MSE sooner than the old 3 x 15 s", () => {
    expect(connectTimeoutMs("webrtc")).toBeLessThanOrEqual(8_000);
    expect(maxFailures("webrtc") * connectTimeoutMs("webrtc")).toBeLessThanOrEqual(20_000);
    expect(connectTimeoutMs("mse")).toBe(15_000);
    expect(maxFailures("mse")).toBe(3);
  });
});

describe("preferredTransport / rememberMse", () => {
  const memory = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };

  it("starts with WebRTC when nothing is remembered or there is no storage", () => {
    expect(preferredTransport(memory(), 1_000)).toBe("webrtc");
    expect(preferredTransport(null, 1_000)).toBe("webrtc");
  });

  it("remembers MSE for MSE_PREFERRED_TTL_MS, then tries WebRTC again", () => {
    const store = memory();
    rememberMse(store, 1_000);
    expect(preferredTransport(store, 1_000 + MSE_PREFERRED_TTL_MS - 1)).toBe("mse");
    expect(preferredTransport(store, 1_000 + MSE_PREFERRED_TTL_MS)).toBe("webrtc");
  });

  it("ignores a corrupt value", () => {
    const store = memory();
    store.setItem("wgw.camera.mse-until", "not-a-number");
    expect(preferredTransport(store, 1_000)).toBe("webrtc");
  });

  it("survives storage that throws (Safari private mode)", () => {
    const boom = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(preferredTransport(boom, 1_000)).toBe("webrtc");
    expect(() => rememberMse(boom, 1_000)).not.toThrow();
  });
});
