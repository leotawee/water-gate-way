import { Radio } from "lucide-react";
import type { GateStatus } from "@/lib/telemetry/parseStatus";
import Reading from "./Reading";
import LiveIcon from "./LiveIcon";

export default function RadarCard({ radar, live }: { radar: GateStatus["radar"] | null; live: boolean }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="card-title">
          <Radio className="size-4 text-accent" aria-hidden="true" />
          Radar — Water Level
        </h3>
        <LiveIcon live={live} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 p-3">
          <span className="text-sm font-medium text-muted">Liquid</span>
          <Reading value={radar?.liquid ?? null} digits={3} unit="meters" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 p-3">
          <span className="text-sm font-medium text-muted">Air Gap</span>
          <Reading value={radar?.airGap ?? null} digits={3} unit="meters" />
        </div>
      </div>
    </div>
  );
}
