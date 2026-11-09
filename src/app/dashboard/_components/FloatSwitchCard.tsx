import { Waves } from "lucide-react";
import CardTitle from "@/components/CardTitle";
import StatePill from "@/components/StatePill";

// The STM32 reads the water level from RS485 RADAR first, falls back to ALS-MPM RADAR, then to the floats (owner, 2026-11-09).
// shortcut: the 46-byte status frame carries no "active source" field, so the active one is fixed here from the owner's word and
// shown only while telemetry is live; a firmware fallback is invisible. Upgrade: send the active source in the frame.
const ACTIVE = "rs485";
const SOURCES = [
  { key: "rs485", label: "RS485 RADAR" },
  { key: "als", label: "ALS-MPM RADAR" },
  { key: "float", label: "ลูกลอย" },
] as const;

const FLOATS = [
  { key: "f1", label: "ลูกลอย F1" },
  { key: "f2", label: "ลูกลอย F2" },
  { key: "f3", label: "ลูกลอย F3" },
] as const;

const ROW = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5";

/** Level sensors in fallback order with the one in use, then the three float inputs F1-F3 (on/off/unknown vocabulary). */
export default function FloatSwitchCard({ float, live }: { float: Record<string, boolean> | null; live: boolean }) {
  return (
    <section aria-labelledby="float-heading">
      <CardTitle id="float-heading" icon={Waves}>
        เซ็นเซอร์วัดระดับน้ำ
      </CardTitle>
      <dl className="mt-2">
        {SOURCES.map(({ key, label }) => (
          <div key={key} className={ROW}>
            <dt className="text-sm text-muted">{label}</dt>
            <dd>
              {/* WHY: stale telemetry must never look live, so it reads as unknown. */}
              {!live ? (
                <StatePill tone="unknown">ไม่ทราบสถานะ</StatePill>
              ) : key === ACTIVE ? (
                <StatePill tone="on">ใช้อยู่</StatePill>
              ) : (
                <StatePill tone="off">สำรอง</StatePill>
              )}
            </dd>
          </div>
        ))}
      </dl>
      <dl className="mt-2 border-t border-rule pt-2">
        {FLOATS.map(({ key, label }) => {
          // WHY: a missing key means the payload did not report it; show unknown, not OFF.
          const on = live ? float?.[key] : undefined;
          return (
            <div key={key} className={ROW}>
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
