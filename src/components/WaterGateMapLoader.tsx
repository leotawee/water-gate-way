"use client";

import dynamic from "next/dynamic";
import type { Gate } from "@/lib/gates";

const WaterGateMap = dynamic(() => import("@/components/WaterGateMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 rounded-full border-2 border-muted border-t-transparent animate-spin" />
        <span className="text-sm text-muted">กำลังโหลดแผนที่…</span>
      </div>
    </div>
  ),
});

export default function WaterGateMapLoader({ gates }: { gates: Gate[] }) {
  // WHY anim-fade-in: the spinner -> map swap is a full replacement; a one-shot 180 ms fade
  // softens the handoff without touching the documented tile fadeAnimation fix.
  return (
    <div className="anim-fade-in h-full w-full">
      <WaterGateMap gates={gates} />
    </div>
  );
}
