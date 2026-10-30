import { Radio } from "lucide-react";
import type { GateStatus } from "@/lib/telemetry/parseStatus";
import Reading from "./Reading";
import LiveIcon from "./LiveIcon";

export default function RadarCard({ radar, live }: { radar: GateStatus["radar"] | null; live: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-cyan-500" />
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Radar — Water Level</h3>
        </div>
        <LiveIcon live={live} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-50 border border-cyan-100">
          <span className="text-sm font-semibold text-gray-600">Liquid</span>
          <Reading value={radar?.liquid ?? null} digits={3} unit="meters" color="text-cyan-600" />
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50 border border-sky-100">
          <span className="text-sm font-semibold text-gray-600">Air Gap</span>
          <Reading value={radar?.airGap ?? null} digits={3} unit="meters" color="text-sky-600" />
        </div>
      </div>
    </div>
  );
}
