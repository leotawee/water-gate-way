"use client";

import dynamic from "next/dynamic";

const WaterGateMap = dynamic(() => import("@/components/WaterGateMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-500 font-medium">Loading Map…</span>
      </div>
    </div>
  ),
});

export default function WaterGateMapLoader() {
  return <WaterGateMap />;
}
