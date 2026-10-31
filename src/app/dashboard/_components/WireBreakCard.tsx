import { CircleAlert, CircleCheck, Minus, Cable } from "lucide-react";
import type { GateStatus } from "@/lib/telemetry/parseStatus";

const WIRES = [
  { key: "red", label: "Red (WB1)", bar: "bg-danger" },
  { key: "blue", label: "Blue (WB2)", bar: "bg-blue-500" },
] as const;

export default function WireBreakCard({ wireBreak, live }: { wireBreak: GateStatus["wireBreak"] | null; live: boolean }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="card-title">
          <Cable className="size-4 text-accent" aria-hidden="true" />
          Wire Break
        </h3>
        <span
          className={`pill ${live ? "bg-ok/10 text-ok ring-ok/40" : "bg-surface-2 text-muted ring-border"}`}
        >
          {live ? "Live" : "Offline"}
        </span>
      </div>

      <div className="space-y-2">
        {WIRES.map(({ key, label, bar }) => {
          const broken = wireBreak?.[key] ?? null;
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 p-3"
            >
              <div className="flex items-center gap-3">
                <div className={`h-8 w-1 rounded-full ${bar}`} aria-hidden="true" />
                <span className="text-sm font-medium text-fg">{label}</span>
              </div>
              {broken === null ? (
                <span className="pill bg-surface-2 text-muted ring-border">
                  <Minus className="size-3.5" aria-hidden="true" />
                  —
                </span>
              ) : broken ? (
                <span className="pill bg-danger/10 text-danger ring-danger/40">
                  <CircleAlert className="size-3.5" aria-hidden="true" />
                  BROKEN
                </span>
              ) : (
                <span className="pill bg-ok/10 text-ok ring-ok/40">
                  <CircleCheck className="size-3.5" aria-hidden="true" />
                  NORMAL
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
