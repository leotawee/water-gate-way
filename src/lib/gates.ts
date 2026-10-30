export type Gate = { id: string; name: string; lat: number; lng: number; hasDevice: boolean };

// WHY: only gate-1 has an STM32 + cameras installed; the others show "No device installed".
export const GATES: Gate[] = [
  { id: "gate-1", name: "Gate 1 - Nam Ping", lat: 18.795, lng: 99.015, hasDevice: true },
  { id: "gate-2", name: "Gate 2 - Huay Kaew", lat: 18.81, lng: 98.948, hasDevice: false },
  { id: "gate-3", name: "Gate 3 - Mae Kuang", lat: 18.895, lng: 99.18, hasDevice: false },
  { id: "gate-4", name: "Gate 4 - Mae Rim", lat: 18.926, lng: 98.94, hasDevice: false },
  { id: "gate-5", name: "Gate 5 - Hang Dong", lat: 18.684, lng: 98.92, hasDevice: false },
];

/** go2rtc stream names the camera proxy may request. */
export const CAMERAS = ["office1", "office2", "office3"] as const;
export type Camera = (typeof CAMERAS)[number];

export function getGate(id: string | undefined): Gate | null {
  return GATES.find((g) => g.id === id) ?? null;
}
