import { Waves } from "lucide-react";
import CardTitle from "@/components/CardTitle";
import StatePill from "@/components/StatePill";

// WHY: labels set by the owner (2026-11-09), in this order. docs/diagram/1.drawio draws these three inputs as Float1-3 and the
// 46-byte status frame carries them as float_state bits 0-2 only; no radar status field exists in the frame. Confirm with the
// firmware owner that F1/F2 really report the two radars' status before relying on these names.
const ROWS = [
  { key: "f1", label: "RS485 RADAR (status)" },
  { key: "f2", label: "ALS-MPM RADAR (status)" },
  { key: "f3", label: "ลูกลอย" },
] as const;

/** Float switches F1–F3 with the shared on/off/unknown vocabulary (word + dot). */
export default function FloatSwitchCard({ float, live }: { float: Record<string, boolean> | null; live: boolean }) {
  return (
    <section aria-labelledby="float-heading">
      <CardTitle id="float-heading" icon={Waves}>
        ลูกลอย
      </CardTitle>
      <dl className="mt-2">
        {ROWS.map(({ key, label }) => {
          // WHY: a missing key means the payload did not report it; show unknown, not OFF.
          // Stale telemetry must never look live, so it reads as unknown too.
          const on = live ? float?.[key] : undefined;
          return (
            <div key={key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5">
              <dt className="text-sm text-muted">{label}</dt>
              <dd>
                {on === undefined ? (
                  <StatePill tone="unknown">ไม่ทราบสถานะ</StatePill>
                ) : on ? (
                  <StatePill tone="on">ทำงาน</StatePill>
                ) : (
                  <StatePill tone="off">ปิดอยู่</StatePill>
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
