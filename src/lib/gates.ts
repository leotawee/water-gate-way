export type Gate = { id: string; name: string; lat: number; lng: number; hasDevice: boolean };

/** go2rtc stream names the camera proxy may request. */
export const CAMERAS = ["office1", "office2", "office3"] as const;
export type Camera = (typeof CAMERAS)[number];

// WHY: the id is a URL segment, a DB key and an MQTT topic level; reject anything else before it reaches any of them.
export const GATE_ID_RE = /^gate-[0-9]{1,4}$/;
export function isGateId(v: unknown): v is string {
  return typeof v === "string" && GATE_ID_RE.test(v);
}
