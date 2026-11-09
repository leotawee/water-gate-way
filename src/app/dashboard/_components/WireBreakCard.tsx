import type { GateStatus } from "@/lib/telemetry/parseStatus";
import { Cable } from "lucide-react";
import CardTitle from "@/components/CardTitle";
import StatePill from "@/components/StatePill";

const WIRES = [
  { key: "red", label: "WB1 (สายแดง)" },
  { key: "blue", label: "WB2 (สายน้ำเงิน)" },
] as const;

/** Wire-break loops; a broken loop is an alarm, so it uses the danger tone. */
export default function WireBreakCard({ wireBreak, live }: { wireBreak: GateStatus["wireBreak"] | null; live: boolean }) {
  return (
    <section aria-labelledby="wire-heading">
      <CardTitle id="wire-heading" icon={Cable}>
        สายขาด
      </CardTitle>
      <dl className="mt-2">
        {WIRES.map(({ key, label }) => {
          // WHY: stale telemetry must never look live; an unread loop reads as unknown.
          const broken = live ? (wireBreak?.[key] ?? null) : null;
          return (
            <div key={key} className="flex items-center justify-between gap-4 py-1.5">
              <dt className="text-sm text-muted">{label}</dt>
              <dd>
                {broken === null ? (
                  <StatePill tone="unknown">ไม่ทราบสถานะ</StatePill>
                ) : broken ? (
                  <StatePill tone="danger">ขาด</StatePill>
                ) : (
                  <StatePill tone="on">ปกติ</StatePill>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
