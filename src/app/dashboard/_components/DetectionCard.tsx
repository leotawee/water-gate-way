function StateWord({ seen, unknown }: { seen: boolean; unknown: boolean }) {
  if (unknown) {
    return (
      <span className="hatch inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-bold text-muted">
        <span className="size-2 shrink-0 rounded-full border-2 border-dashed border-unknown" aria-hidden="true" />
        ไม่ทราบสถานะ
      </span>
    );
  }
  return seen ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-bold text-warn">
      <span className="size-2 shrink-0 rounded-full bg-warn" aria-hidden="true" />
      พบคน
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-off-soft px-2.5 py-1 text-xs font-bold text-off">
      <span className="size-2 shrink-0 rounded-full bg-off" aria-hidden="true" />
      ไม่พบคน
    </span>
  );
}

/** Person detection count; a detection is a warning, so "พบคน" uses the warn tone. */
export default function DetectionCard({ personCount, live = true }: { personCount: number | null; live?: boolean }) {
  const unknown = personCount === null || !live;
  const seen = !unknown && personCount > 0;
  return (
    <section aria-label="การตรวจจับ">
      <h3 className="mb-1 text-sm font-bold text-fg">การตรวจจับ</h3>
      <div className="flex items-center justify-between gap-4 py-2">
        <span className="text-sm text-muted">จำนวนคนที่ตรวจพบ</span>
        <span className="flex items-center gap-3">
          <span className={`text-base font-bold tabular-nums ${unknown ? "text-muted" : seen ? "text-warn" : "text-fg"}`}>
            {unknown ? "—" : personCount}
          </span>
          <StateWord seen={seen} unknown={unknown} />
        </span>
      </div>
    </section>
  );
}
