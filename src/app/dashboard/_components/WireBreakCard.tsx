import { Cable } from "lucide-react";
import type { GateStatus } from "@/lib/telemetry/parseStatus";

const WIRES = [
  { key: "red", label: "สายขาด WB1 (สายแดง)" },
  { key: "blue", label: "สายขาด WB2 (สายน้ำเงิน)" },
] as const;

function StateWord({ broken }: { broken: boolean | null }) {
  if (broken === null) {
    return (
      <span className="hatch inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-bold text-muted">
        <span className="size-2 shrink-0 rounded-full border-2 border-dashed border-unknown" aria-hidden="true" />
        ไม่ทราบสถานะ
      </span>
    );
  }
  // Alarm-type state: broken wire reads danger; intact reads the on-green.
  return broken ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-bold text-danger">
      <span className="size-2 shrink-0 rounded-full bg-danger" aria-hidden="true" />
      ขาด
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-on-soft px-2.5 py-1 text-xs font-bold text-on">
      <span className="size-2 shrink-0 rounded-full bg-on" aria-hidden="true" />
      ปกติ
    </span>
  );
}

/** Wire-break loops; a broken loop is an alarm, so it uses the danger tone. */
export default function WireBreakCard({ wireBreak, live }: { wireBreak: GateStatus["wireBreak"] | null; live: boolean }) {
  return (
    <section aria-label="สายขาด">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-fg">
        <Cable className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
        สายขาด
      </h3>
      {WIRES.map(({ key, label }) => {
        // WHY: stale telemetry must never look live; an unread loop reads as unknown.
        const broken = live ? (wireBreak?.[key] ?? null) : null;
        return (
          <div key={key} className="flex items-center justify-between gap-4 py-2">
            <span className="text-sm text-muted">{label}</span>
            <StateWord broken={broken} />
          </div>
        );
      })}
    </section>
  );
}
