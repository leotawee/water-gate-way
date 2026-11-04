"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  type TooltipValueType,
} from "recharts";
import { Download } from "lucide-react";
import { useRedirectToLogin } from "@/hooks/useRedirectToLogin";
import { LEVEL_DANGER_M, LEVEL_MAX_M, LEVEL_WARN_M } from "./levels";

// WHY: Recharts takes SVG attributes, which cannot read CSS variables; these mirror the @theme tokens in globals.css.
const CHART = {
  accent: "#3860b0",
  grid: "#eef0ec",
  axis: "#c9cec6",
  tick: "#55606a",
  warn: "#a35207",
  danger: "#b4231b",
  fg: "#142029",
  border: "#e1e4df",
  /** Ring around the active dot: the panel surface, so it reads as a cut-out. */
  bgRing: "#ffffff",
} as const;

interface DataPoint {
  time: string;
  level: number;
}

interface ApiWaterLevel {
  id: number;
  device_id: string;
  water_height: number;
  measured_at: string;
}

const POLL_MS = 5 * 60 * 1000;

function mapApiToChart(rows: ApiWaterLevel[]): DataPoint[] {
  return rows.map((row) => ({
    time: new Date(row.measured_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    level: Number(row.water_height),
  }));
}

const formatTooltip = (value: TooltipValueType | undefined): [string, string] => {
  const raw = Array.isArray(value) ? value[0] : value;
  const num = typeof raw === "number" ? raw : Number(raw ?? 0);
  return [`${num.toFixed(2)} ม.`, "ระดับน้ำ"];
};

/* Thresholds in Thai words, so colour never carries the meaning alone. */
const REFS = [
  { y: LEVEL_WARN_M, color: CHART.warn, label: `ระดับเตือน ${LEVEL_WARN_M} ม.` },
  { y: LEVEL_DANGER_M, color: CHART.danger, label: `ระดับอันตราย ${LEVEL_DANGER_M} ม.` },
];

/** History of the stored water levels (the last 24 rows), with the CSV export of the same table. */
export default function WaterLevelChart() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const redirectToLogin = useRedirectToLogin();

  const fetchWaterLevels = useCallback(async () => {
    try {
      const res = await fetch("/api/water-level", { cache: "no-store" });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows: unknown = await res.json();
      if (!Array.isArray(rows)) throw new Error("Response is not an array");
      setData(mapApiToChart(rows as ApiWaterLevel[]));
      setError(null);
    } catch (err) {
      // WHY: clear stale points so the chart never shows data we failed to refresh
      console.error("[Dashboard] Failed to fetch water levels:", err);
      setData([]);
      setError("โหลดประวัติระดับน้ำไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [redirectToLogin]);

  useEffect(() => {
    // WHY: the first load awaits the network before any setState, so this is not a synchronous update.
    void (async () => {
      await fetchWaterLevels();
    })();
    const id = setInterval(fetchWaterLevels, POLL_MS);
    return () => clearInterval(id);
  }, [fetchWaterLevels]);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h3 className="text-sm font-bold text-fg">ประวัติ 24 ค่าล่าสุด</h3>
        <a
          id="download-graph-data"
          href="/api/water-level/download"
          download="water_levels_report.csv"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm text-muted transition-colors duration-(--dur-base) hover:bg-surface-2 hover:text-fg"
        >
          <Download className="size-4" strokeWidth={1.75} aria-hidden="true" />
          ดาวน์โหลด CSV
        </a>
      </div>

      {/* WHY: every state keeps the plot's height, so nothing below jumps when the data lands. */}
      {data.length === 0 ? (
        <div role="status" className="flex h-60 lg:h-[24rem] w-full items-center justify-center rounded-md border border-dashed border-border">
          <span className={`text-sm ${error ? "text-danger" : "text-muted"}`}>
            {loading ? "กำลังโหลดข้อมูล…" : (error ?? "ยังไม่มีข้อมูลระดับน้ำที่บันทึกไว้")}
          </span>
          {error && (
            <button
              type="button"
              onClick={fetchWaterLevels}
              className="ml-3 cursor-pointer text-sm font-bold text-fg underline underline-offset-2 hover:no-underline"
            >
              ลองอีกครั้ง
            </button>
          )}
        </div>
      ) : (
        <div
          // WHY role="img": Recharts renders an unlabelled SVG; the trend is non-text content that
          // needs an accessible name (WCAG 1.1.1). The numbers themselves stay in the gauge + CSV.
          role="img"
          aria-label={`กราฟประวัติระดับน้ำ 24 ค่าล่าสุด พร้อมเส้นระดับเตือน ${LEVEL_WARN_M} เมตร และระดับอันตราย ${LEVEL_DANGER_M} เมตร`}
          className="h-60 lg:h-[24rem] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={CHART.grid} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 12, fill: CHART.tick }}
                tickLine={false}
                axisLine={{ stroke: CHART.axis }}
                interval="preserveStartEnd"
                minTickGap={24}
              />
              {/* Fixed width wide enough for "8 ม." ticks, so the unit never clips at 375px. */}
              <YAxis
                domain={[0, LEVEL_MAX_M]}
                ticks={[0, 2, 4, 6, 8]}
                width={44}
                tick={{ fontSize: 12, fill: CHART.tick }}
                tickLine={false}
                axisLine={false}
                unit=" ม."
              />
              <Tooltip
                formatter={formatTooltip}
                cursor={{ stroke: CHART.tick, strokeOpacity: 0.4 }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: `1px solid ${CHART.border}`,
                  borderRadius: 6,
                  color: CHART.fg,
                  fontSize: 12,
                }}
                labelStyle={{ color: CHART.tick }}
                itemStyle={{ color: CHART.fg }}
              />
              {REFS.map((r) => (
                <ReferenceLine
                  key={r.y}
                  y={r.y}
                  stroke={r.color}
                  strokeDasharray="4 3"
                  // WHY: inside positions keep every label inside the SVG, so long Thai threshold
                  // labels can never be clipped off the chart edge at narrow widths.
                  label={{ value: r.label, position: "insideTopLeft", fill: r.color, fontSize: 12 }}
                />
              ))}
              {/* Straight segments: a smoothed curve would invent levels between readings. */}
              <Line
                type="linear"
                dataKey="level"
                stroke={CHART.accent}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                activeDot={{ r: 4, fill: CHART.accent, stroke: CHART.bgRing, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
