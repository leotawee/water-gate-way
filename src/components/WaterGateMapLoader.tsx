"use client";

import dynamic from "next/dynamic";
import type { Gate } from "@/lib/gates";

const WaterGateMap = dynamic(() => import("@/components/WaterGateMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <div className="size-10 rounded-full border-4 border-accent border-t-transparent animate-spin" />
        <span className="text-sm text-muted font-medium">Loading Map…</span>
      </div>
    </div>
  ),
});

export default function WaterGateMapLoader({ gates }: { gates: Gate[] }) {
  return <WaterGateMap gates={gates} />;
}
