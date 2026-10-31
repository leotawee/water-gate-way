import { CircleAlert, ScanLine } from "lucide-react";

export default function DetectionCard({ personCount }: { personCount: number | null }) {
  const seen = personCount !== null && personCount > 0;
  return (
    <div className={`card text-center transition-colors duration-300 ${seen ? "border-warn/50 bg-warn/5" : ""}`}>
      <h3 className="card-title justify-center">
        <ScanLine className="size-4 text-accent" aria-hidden="true" />
        AI Detection
      </h3>
      <div
        className={`mt-3 font-mono text-2xl font-semibold ${seen ? "text-warn" : personCount === null ? "text-muted" : "text-ok"}`}
      >
        {personCount === null ? "—" : seen ? "เจอคน" : "ไม่มีคน"}
      </div>
      {seen && (
        <span className="pill mt-2 bg-warn/10 text-warn ring-warn/40">
          <CircleAlert className="size-3.5" aria-hidden="true" />
          Person detected! ({personCount})
        </span>
      )}
      <div className="mt-2 text-[11px] font-medium text-muted">Mode: {personCount === null ? "—" : seen ? "M1" : "M0"}</div>
    </div>
  );
}
