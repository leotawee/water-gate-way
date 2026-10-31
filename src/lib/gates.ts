export type Gate = { id: string; name: string; lat: number; lng: number; hasDevice: boolean };

/** go2rtc stream names the camera proxy may request. */
export const CAMERAS = ["office1", "office2", "office3"] as const;
export type Camera = (typeof CAMERAS)[number];
