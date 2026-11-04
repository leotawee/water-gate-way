import { useEffect, useState } from "react";
import type { GateStatus } from "@/lib/telemetry/parseStatus";
import { NO_CURRENT_HOLD_MS, noCurrentWhilePumpOn } from "./noCurrent";
import Reading from "./Reading";

const ROWS = [
  { key: "voltage", label: "แรงดัน", digits: 1, unit: "V", tint: "bg-tint-cream" },
  { key: "current", label: "กระแส", digits: 2, unit: "A", tint: "bg-tint-peach" },
  { key: "frequency", label: "ความถี่", digits: 2, unit: "Hz", tint: "bg-tint-blue" },
  { key: "power", label: "กำลังไฟ", digits: 1, unit: "W", tint: "bg-tint-sky" },
] as const;

const PHASE_NAMES = ["R", "S", "T"] as const;
const PHASE_ROWS = [
  { key: "voltage", label: "แรงดัน (V)", digits: 1 },
  { key: "current", label: "กระแส (A)", digits: 2 },
  { key: "power", label: "กำลัง (W)", digits: 1 },
] as const;
// WHY: a real 0 prints as 0, only a missing value is a dash.
const fmt = (v: number | null, digits: number) => (v === null ? "—" : v.toFixed(digits));

/**
 * Says why a 0.00 A reading is suspicious once it has held for NO_CURRENT_HOLD_MS.
 * WHY mounted only while the condition holds: unmounting resets the hold, and the state is set from the timer
 * callback, never synchronously inside the effect.
 */
function NoCurrentHint() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShown(true), NO_CURRENT_HOLD_MS);
    return () => clearTimeout(t);
  }, []);
  return shown ? <p className="mt-3 text-sm text-warn">ไม่พบกระแส ทั้งที่ปั๊มทำงาน ตรวจเซ็นเซอร์กระแส</p> : null;
}

/** Voltage, current, frequency and power from the PZEM meter, as one definition list. */
export default function ElectricCard({
  pzem,
  devices,
  live,
}: {
  pzem: GateStatus["pzem"] | null;
  devices: GateStatus["devices"] | null;
  live: boolean;
}) {
  // WHY: stale readings stay visible but muted, so an old value is never mistaken for a live one.
  const c = live ? "text-fg" : "text-muted";
  return (
    <section aria-labelledby="electric-heading">
      <h3 id="electric-heading" className="text-sm font-bold text-fg">
        ไฟฟ้า (PZEM)
      </h3>
      <dl className="mt-3 space-y-2">
        {ROWS.map((r) => (
          <div key={r.key} className={`flex items-baseline justify-between gap-4 rounded-xl px-3 py-2.5 ${r.tint}`}>
            <dt className="text-sm text-muted">{r.label}</dt>
            <dd>
              <Reading value={pzem?.[r.key] ?? null} digits={r.digits} unit={r.unit} color={c} />
            </dd>
          </div>
        ))}
      </dl>
      {pzem?.phases && (
        <table className="mt-3 w-full text-sm tabular-nums">
          <caption className="sr-only">ไฟฟ้ารายเฟส R S T</caption>
          <thead>
            <tr>
              <td />
              {pzem.phases.map((_, i) => (
                <th key={i} scope="col" className="pb-1 text-right font-bold text-fg">
                  {PHASE_NAMES[i]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PHASE_ROWS.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="py-1 pr-2 text-left font-normal text-muted">
                  {r.label}
                </th>
                {pzem.phases!.map((ph, i) => (
                  <td key={i} className={`py-1 text-right font-bold ${c}`}>
                    {fmt(ph[r.key], r.digits)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {live && noCurrentWhilePumpOn(devices, pzem) && <NoCurrentHint />}
    </section>
  );
}
