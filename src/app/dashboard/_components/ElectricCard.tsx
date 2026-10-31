import type { GateStatus } from "@/lib/telemetry/parseStatus";
import Reading from "./Reading";

/** Voltage, current, frequency and power from the 3-phase meter, as one definition list section. */
export default function ElectricCard({ pzem, live }: { pzem: GateStatus["pzem"] | null; live: boolean }) {
  // WHY: stale readings stay visible but muted, so an old value is never mistaken for a live one.
  const c = live ? "text-fg" : "text-muted";
  return (
    <section aria-label="ไฟฟ้า">
      <h3 className="mb-1 text-sm font-bold text-fg">ไฟฟ้า (PZEM)</h3>
      <div className="flex items-center justify-between gap-4 py-2">
        <span className="text-sm text-muted">แรงดัน</span>
        <Reading value={pzem?.voltage ?? null} digits={1} unit="V" color={c} />
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <span className="text-sm text-muted">กระแส</span>
        <Reading value={pzem?.current ?? null} digits={2} unit="A" color={c} />
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <span className="text-sm text-muted">ความถี่</span>
        <Reading value={pzem?.frequency ?? null} digits={2} unit="Hz" color={c} />
      </div>
      <div className="flex items-center justify-between gap-4 py-2">
        <span className="text-sm text-muted">กำลังไฟ</span>
        <Reading value={pzem?.power ?? null} digits={1} unit="W" color={c} />
      </div>
    </section>
  );
}
