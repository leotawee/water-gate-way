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
import { Droplets } from "lucide-react";

// WHY: Recharts takes SVG attributes, which cannot read CSS variables; these mirror the @theme tokens in globals.css.
const CHART = {
  accent: "#0a58a3",
  grid: "#d3d8d0",
  axis: "#d3d8d0",
  tick: "#55606a",
  on: "#157f3c",
  warn: "#a35207",
  danger: "#b4231b",
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

const REFS = [
  { y: 1, color: CHART.on, label: "1 ม." },
  { y: 3, color: CHART.warn, label: "3 ม. (P2)" },
  { y: 5, color: CHART.danger, label: "5 ม. (P1)" },
  { y: 7, color: CHART.danger, label: "7 ม." },
];

export default function WaterLevelChart() {
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWaterLevels = useCallback(async () => {
    try {
      const res = await fetch("/api/water-level", { cache: "no-store" });
      if (res.status === 401) {
        window.location.assign("/login?next=" + encodeURIComponent(location.pathname + location.search));
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
      setError("โหลดข้อมูลระดับน้ำไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaterLevels();
    const id = setInterval(fetchWaterLevels, POLL_MS);
    return () => clearInterval(id);
  }, [fetchWaterLevels]);

  const current = data.at(-1)?.level;

  return (
    <section aria-labelledby="water-level-heading" className="rounded-lg border border-border bg-surface p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="water-level-heading" className="flex items-center gap-2 text-base font-bold text-fg">
          <Droplets className="size-5 text-accent" strokeWidth={1.75} aria-hidden="true" />
          ระดับน้ำ — 24 ชั่วโมง
        </h2>
        {current !== undefined && (
          <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-bold tabular-nums text-accent">
            ปัจจุบัน {current.toFixed(2)} ม.
          </span>
        )}
      </div>

      {loading && data.length === 0 ? (
        <div className="flex h-64 w-full items-center justify-center sm:h-80">
          <div className="flex flex-col items-center gap-2">
            <div className="size-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
            <span className="text-xs text-muted">กำลังโหลดข้อมูล…</span>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-64 w-full items-center justify-center sm:h-80">
          <span className={`text-xs ${error ? "text-danger" : "text-muted"}`}>{error ?? "ยังไม่มีข้อมูลระดับน้ำ"}</span>
        </div>
      ) : (
        <div className="h-64 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} strokeOpacity={0.7} />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 11, fill: CHART.tick }}
                tickLine={false}
                axisLine={{ stroke: CHART.axis }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 8]}
                ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8]}
                tick={{ fontSize: 11, fill: CHART.tick }}
                tickLine={false}
                axisLine={{ stroke: CHART.axis }}
                unit=" ม."
              />
              <Tooltip
                formatter={formatTooltip}
                cursor={{ stroke: CHART.tick, strokeOpacity: 0.4 }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #d3d8d0",
                  borderRadius: 8,
                  color: "#142029",
                  fontSize: 12,
                }}
                labelStyle={{ color: "#55606a" }}
                itemStyle={{ color: "#142029" }}
              />
              {REFS.map((r) => (
                <ReferenceLine
                  key={r.y}
                  y={r.y}
                  stroke={r.color}
                  strokeDasharray="6 3"
                  label={{ value: r.label, position: "right", fill: r.color, fontSize: 10 }}
                />
              ))}
              <Line
                type="monotone"
                dataKey="level"
                stroke={CHART.accent}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: CHART.accent, stroke: CHART.bgRing, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
