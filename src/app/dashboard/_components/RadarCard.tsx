import type { GateStatus } from "@/lib/telemetry/parseStatus";
import Reading from "./Reading";

/** Radar water level and the sensor-to-surface gap, as one definition list section. */
export default function RadarCard({ radar, live }: { radar: GateStatus["radar"] | null; live: boolean }) {
  // WHY: stale readings stay visible but muted, so an old value is never mistaken for a live one.
  const c = live ? "text-fg" : "text-muted";
  return (
    <section aria-label="ระดับน้ำ">
      <h3 className="mb-1 text-sm font-bold text-fg">ระดับน้ำ (เรดาร์)</h3>
      <div className="flex items-center justify-between gap-4 py-2">
        <span className="text-sm text-muted">ระดับน้ำ</span>
        <Reading value={radar?.liquid ?? null} digits={3} unit="ม." color={c} />
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <span className="text-sm text-muted">ระยะเซนเซอร์ถึงผิวน้ำ</span>
        <Reading value={radar?.airGap ?? null} digits={3} unit="ม." color={c} />
      </div>
    </section>
  );
}
