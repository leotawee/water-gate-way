export type Transport = "webrtc" | "mse";

// WHY: the relay is non-trickle, so the offer must already carry a server-reflexive (srflx) candidate or
// the Pi cannot punch a hole towards a phone off the LAN/tailnet. Measured in Chrome: host candidates
// arrive at ~5 ms, srflx at ~50 ms, and the "complete" event never arrives (so waiting for it burns the cap).
export const ICE_SETTLE_MS = 250; // collect a little more after the first srflx (IPv6, second interface)
export const ICE_CAP_MS = 2_500; // STUN blocked: send a host-only offer rather than hang

// WHY: a failed WebRTC attempt used to cost 15 s, three times, before the MSE fallback (~60 s measured on a phone).
// The attempt clock also covers the ICE wait (<= 2.5 s), the POST through the tunnel and the wait for the first
// keyframe, so 12 s leaves room on slow cellular; two misses still reach MSE in about 26 s instead of 60.
const WEBRTC_CONNECT_TIMEOUT_MS = 12_000;
const MSE_CONNECT_TIMEOUT_MS = 15_000;
const WEBRTC_MAX_FAILURES = 2;
const MSE_MAX_FAILURES = 3;

export const connectTimeoutMs = (t: Transport) => (t === "webrtc" ? WEBRTC_CONNECT_TIMEOUT_MS : MSE_CONNECT_TIMEOUT_MS);
export const maxFailures = (t: Transport) => (t === "webrtc" ? WEBRTC_MAX_FAILURES : MSE_MAX_FAILURES);

type IcePc = Pick<RTCPeerConnection, "iceGatheringState" | "localDescription" | "addEventListener" | "removeEventListener">;

// WHY \b and no surrounding spaces: a srflx line may end right after the type when raddr/rport are omitted.
const SRFLX = /\btyp srflx\b/;

/** Resolves when the offer is worth sending: gathering complete, ICE_SETTLE_MS after the first srflx, or the cap. */
export function waitForIceCandidates(pc: IcePc, capMs = ICE_CAP_MS, settleMs = ICE_SETTLE_MS): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    let settle: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      clearTimeout(cap);
      clearTimeout(settle);
      pc.removeEventListener("icecandidate", onCandidate);
      pc.removeEventListener("icegatheringstatechange", onState);
      resolve();
    };
    const startSettle = () => {
      if (settle === undefined) settle = setTimeout(finish, settleMs);
    };
    const onCandidate = (e: Event) => {
      if (SRFLX.test((e as RTCPeerConnectionIceEvent).candidate?.candidate ?? "")) startSettle();
    };
    // WHY check the state: the first change is "gathering" (it just started), not "complete".
    const onState = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    const cap = setTimeout(finish, capMs);
    pc.addEventListener("icecandidate", onCandidate);
    pc.addEventListener("icegatheringstatechange", onState);
    // WHY: a srflx event can fire between setLocalDescription() and the listener above; the SDP already has it.
    if (SRFLX.test(pc.localDescription?.sdp ?? "")) startSettle();
  });
}

// shortcut: per-browser memory with a TTL, no network-change detection; upgrade if phones roam between Wi-Fi and 4G often.
const MSE_UNTIL_KEY = "wgw.camera.mse-until";
export const MSE_PREFERRED_TTL_MS = 10 * 60_000;
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** After WebRTC failed here and MSE then played, start the next page loads on MSE for a while instead of paying the timeouts again. */
export function rememberMse(store: Store | null, nowMs: number): void {
  try {
    store?.setItem(MSE_UNTIL_KEY, String(nowMs + MSE_PREFERRED_TTL_MS));
  } catch {
    // storage blocked (private mode): the tile still falls back, it just forgets
  }
}

/** Forget the fallback (manual retry, or MSE itself is failing): the next page load tries WebRTC first. */
export function forgetMse(store: Store | null): void {
  try {
    store?.removeItem(MSE_UNTIL_KEY);
  } catch {
    // storage blocked: nothing was remembered either
  }
}

export function preferredTransport(store: Store | null, nowMs: number): Transport {
  try {
    const until = Number(store?.getItem(MSE_UNTIL_KEY));
    return Number.isFinite(until) && until > nowMs ? "mse" : "webrtc";
  } catch {
    return "webrtc";
  }
}
