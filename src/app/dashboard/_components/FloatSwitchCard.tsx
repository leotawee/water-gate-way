import { Minus, ToggleLeft, ToggleRight, Waves } from "lucide-react";
import LiveIcon from "./LiveIcon";

const ROWS = [
  { key: "f1", label: "F1 — Upper" },
  { key: "f2", label: "F2 — Lower" },
  { key: "f3", label: "F3" },
];

export default function FloatSwitchCard({ float, live }: { float: Record<string, boolean> | null; live: boolean }) {
  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="card-title">
          <Waves className="size-4 text-accent" aria-hidden="true" />
          Float Switch
        </h3>
        <LiveIcon live={live} />
      </div>

      <div className="space-y-2">
        {ROWS.map(({ key, label }) => {
          // WHY: a missing key means the payload did not report it; show "—", not OFF.
          const on = float?.[key];
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-border bg-surface-2/50 p-3"
            >
              <span className="text-sm font-medium text-fg">{label}</span>
              {on === undefined ? (
                <span className="pill bg-surface-2 text-muted ring-border">
                  <Minus className="size-3.5" aria-hidden="true" />
                  —
                </span>
              ) : on ? (
                <span className="pill bg-ok/10 text-ok ring-ok/40">
                  <ToggleRight className="size-3.5" aria-hidden="true" />
                  ON
                </span>
              ) : (
                <span className="pill bg-surface-2 text-muted ring-border">
                  <ToggleLeft className="size-3.5" aria-hidden="true" />
                  OFF
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
