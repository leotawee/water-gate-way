import { Zap } from "lucide-react";
import type { GateStatus } from "@/lib/telemetry/parseStatus";
import Reading from "./Reading";
import LiveIcon from "./LiveIcon";

export default function ElectricCard({ pzem, live }: { pzem: GateStatus["pzem"] | null; live: boolean }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="card-title">
          <Zap className="size-4 text-accent" aria-hidden="true" />
          PZEM — Electric
        </h3>
        <LiveIcon live={live} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 p-3">
          <span className="text-sm font-medium text-muted">Voltage</span>
          <Reading value={pzem?.voltage ?? null} digits={1} unit="Volts" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 p-3">
          <span className="text-sm font-medium text-muted">Current</span>
          <Reading value={pzem?.current ?? null} digits={2} unit="Amps" />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 p-3">
          <span className="text-sm font-medium text-muted">Frequency</span>
          <Reading value={pzem?.frequency ?? null} digits={2} unit="Hz" />
        </div>
      </div>
    </div>
  );
}
