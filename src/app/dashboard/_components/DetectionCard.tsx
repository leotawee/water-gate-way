import { ScanEye } from "lucide-react";
import CardTitle from "@/components/CardTitle";
import StatePill from "@/components/StatePill";

/** AI person count from the Pi's detector. It renders its own tile because a person near the gate is the one
 *  reading that changes the tile's tint: seen = warn surface, otherwise the plain panel. */
export default function DetectionCard({ personCount, live = true }: { personCount: number | null; live?: boolean }) {
  const unknown = personCount === null || !live;
  const seen = !unknown && personCount > 0;
  return (
    <section
      aria-labelledby="detection-heading"
      className={`min-w-0 rounded-2xl border p-5 transition-colors duration-(--dur-base) ${
        seen ? "border-warn bg-warn-soft" : "border-border bg-surface"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <CardTitle id="detection-heading" icon={ScanEye}>
            การตรวจจับคน (AI)
          </CardTitle>
          <div role="status">
            {unknown ? (
              <StatePill tone="unknown">ไม่ทราบสถานะ</StatePill>
            ) : seen ? (
              <StatePill tone="warn">พบคน</StatePill>
            ) : (
              <StatePill tone="off">ไม่พบคน</StatePill>
            )}
          </div>
        </div>
        <p className={`text-4xl leading-none font-bold tabular-nums ${unknown ? "text-muted" : seen ? "text-warn" : "text-fg"}`}>
          {unknown ? "—" : personCount}
          <span className="ml-1.5 text-sm font-bold text-muted">คน</span>
        </p>
      </div>
    </section>
  );
}
