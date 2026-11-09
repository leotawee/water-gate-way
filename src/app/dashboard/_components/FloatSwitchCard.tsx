import { Waves } from "lucide-react";
import CardTitle from "@/components/CardTitle";
import StatePill from "@/components/StatePill";

const ROWS = [
  { key: "f1", label: "ลูกลอย F1" },
  { key: "f2", label: "ลูกลอย F2" },
  { key: "f3", label: "ลูกลอย F3" },
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
            <div key={key} className="flex items-center justify-between gap-4 py-1.5">
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
