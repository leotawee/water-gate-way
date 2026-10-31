// WHY: the HTTP fMP4 pipe is lossless, so any time the <video> does not play becomes backlog that
// never drains on its own. Lag is measured against the lag at the first `playing` event, so slow
// startup (TTFB + first keyframe, several seconds through the proxy) never counts and cannot cause
// a reconnect loop.
export const MAX_LAG_S = 8;
// A start that is this late means playback was held back (blocked autoplay, hidden tab), not slow.
export const MAX_START_LAG_S = 30;

/** Wall time since the request minus media played, in seconds. */
export function lagSeconds(elapsedSinceRequestS: number, currentTime: number): number {
  return elapsedSinceRequestS - currentTime;
}

export function isTooFarBehind(elapsedSinceRequestS: number, currentTime: number, startLagS: number): boolean {
  return startLagS > MAX_START_LAG_S || lagSeconds(elapsedSinceRequestS, currentTime) - startLagS > MAX_LAG_S;
}
