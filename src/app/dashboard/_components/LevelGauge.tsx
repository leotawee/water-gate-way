import StatePill from "@/components/StatePill";
import { BAND_LABEL, LEVEL_DANGER_M, LEVEL_MAX_M, LEVEL_WARN_M, levelBand } from "./levels";

// Gauge geometry (SVG user units): 0 m sits at the bottom, LEVEL_MAX_M at the top.
const H = 240;
const PAD = 10;
const PER_M = (H - PAD * 2) / LEVEL_MAX_M;
const y = (m: number) => H - PAD - Math.min(Math.max(m, 0), LEVEL_MAX_M) * PER_M;

/** Where the level sits against the nearest mark, always naming that mark. */
function relative(m: number): string {
  if (m >= LEVEL_DANGER_M) return `เกินระดับอันตราย ${(m - LEVEL_DANGER_M).toFixed(2)} ม.`;
  if (m >= LEVEL_WARN_M) return `ต่ำกว่าระดับอันตราย ${(LEVEL_DANGER_M - m).toFixed(2)} ม.`;
  return `ต่ำกว่าระดับเตือน ${(LEVEL_WARN_M - m).toFixed(2)} ม.`;
}

export function formatReceived(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })} ${time}`;
}

/** The staff gauge (ไม้วัดระดับน้ำ): the radar's water level against the warning and danger marks.
 *  WHY: stale values stay visible but grey, so an old level is never mistaken for a live one. */
export default function LevelGauge({
  liquid,
  airGap,
  live,
  receivedAt,
}: {
  liquid: number | null;
  airGap: number | null;
  live: boolean;
  receivedAt: string | null;
}) {
  const has = liquid !== null;
  const band = has ? levelBand(liquid) : null;
  const received = formatReceived(receivedAt);

  return (
    <div className="flex items-start gap-5">
      <svg
        viewBox={`0 0 72 ${H}`}
        className="h-60 w-[72px] shrink-0"
        role="img"
        aria-label={has ? `ไม้วัดระดับน้ำ ${liquid.toFixed(2)} เมตร` : "ไม้วัดระดับน้ำ ไม่มีข้อมูล"}
      >
        {/* warning and danger zones, as a thin strip beside the staff */}
        <rect x="48" y={y(LEVEL_DANGER_M)} width="4" height={y(LEVEL_WARN_M) - y(LEVEL_DANGER_M)} className="fill-warn" />
        <rect x="48" y={y(LEVEL_MAX_M)} width="4" height={y(LEVEL_DANGER_M) - y(LEVEL_MAX_M)} className="fill-danger" />
        <rect x="26" y={PAD} width="20" height={H - PAD * 2} className="fill-surface-2" />
        {has && (
          <rect
            x="26"
            y={y(liquid)}
            width="20"
            height={H - PAD - y(liquid)}
            className={live ? "fill-accent/25" : "fill-unknown/20"}
          />
        )}
        {Array.from({ length: LEVEL_MAX_M * 2 + 1 }, (_, i) => i / 2).map((m) => (
          <g key={m}>
            <rect x="26" y={y(m) - 0.5} width={m % 1 === 0 ? 10 : 5} height="1" className="fill-fg" />
            {m % 1 === 0 && (
              <text x="20" y={y(m) + 4} textAnchor="end" className="fill-muted text-xs">
                {m}
              </text>
            )}
          </g>
        ))}
        {has && (
          <rect x="22" y={y(liquid) - 1} width="34" height="2" className={live ? "fill-accent" : "fill-unknown"} />
        )}
      </svg>

      <div className="min-w-0 pt-1">
        <p className="text-sm text-muted">ระดับน้ำตอนนี้</p>
        <p className={`mt-1 text-4xl font-bold tabular-nums ${has && live ? "text-fg" : "text-muted"}`}>
          {has ? liquid.toFixed(2) : "—"}
          {has && <span className="ml-1.5 text-base font-normal text-muted">ม.</span>}
        </p>
        <div className="mt-3">
          {!has ? (
            <StatePill tone="unknown">ยังไม่มีข้อมูลจากเรดาร์</StatePill>
          ) : !live ? (
            <StatePill tone="unknown">ข้อมูลไม่เป็นปัจจุบัน</StatePill>
          ) : (
            <StatePill tone={band === "danger" ? "danger" : band === "warn" ? "warn" : "on"}>{BAND_LABEL[band!]}</StatePill>
          )}
        </div>
        {has && <p className="mt-2 text-sm text-fg">{relative(liquid)}</p>}

        <dl className="mt-5 space-y-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted">เซนเซอร์ถึงผิวน้ำ</dt>
            <dd className="tabular-nums text-fg">{airGap === null ? "—" : `${airGap.toFixed(3)} ม.`}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted">ได้รับข้อมูลเมื่อ</dt>
            <dd className="tabular-nums text-fg">{received ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
