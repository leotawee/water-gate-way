import { Waves } from "lucide-react";

const ROWS = [
  { key: "f1", label: "ลูกลอยบน (F1)" },
  { key: "f2", label: "ลูกลอยล่าง (F2)" },
  { key: "f3", label: "ลูกลอย F3" },
] as const;

function StateWord({ on }: { on: boolean | undefined }) {
  if (on === undefined) {
    return (
      <span className="hatch inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-bold text-muted">
        <span className="size-2 shrink-0 rounded-full border-2 border-dashed border-unknown" aria-hidden="true" />
        ไม่ทราบสถานะ
      </span>
    );
  }
  return on ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-on-soft px-2.5 py-1 text-xs font-bold text-on">
      <span className="size-2 shrink-0 rounded-full bg-on" aria-hidden="true" />
      ทำงาน
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-off-soft px-2.5 py-1 text-xs font-bold text-off">
      <span className="size-2 shrink-0 rounded-full bg-off" aria-hidden="true" />
      ปิดอยู่
    </span>
  );
}

/** Float switches F1–F3 with the shared on/off/unknown vocabulary (word + dot). */
export default function FloatSwitchCard({ float, live }: { float: Record<string, boolean> | null; live: boolean }) {
  return (
    <section aria-label="ลูกลอย">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-bold text-fg">
        <Waves className="size-4 text-muted" strokeWidth={1.75} aria-hidden="true" />
        ลูกลอย
      </h3>
      {ROWS.map(({ key, label }) => {
        // WHY: a missing key means the payload did not report it; show unknown, not OFF.
        // Stale telemetry must never look live, so it reads as unknown too.
        const on = live ? float?.[key] : undefined;
        return (
          <div key={key} className="flex items-center justify-between gap-4 py-2">
            <span className="text-sm text-muted">{label}</span>
            <StateWord on={on} />
          </div>
        );
      })}
    </section>
  );
}
