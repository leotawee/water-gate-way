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
  accent: "#22d3ee",
  grid: "#334155",
  axis: "#334155",
  tick: "#94a3b8",
  ok: "#22c55e",
  warn: "#f59e0b",
  orange: "#f97316",
  danger: "#ef4444",
  /** Ring around the active dot: the page background, so it reads as a cut-out. */
  bgRing: "#020617",
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
  return [`${num.toFixed(2)} m`, "Water Level"];
};

const REFS = [
  { y: 1, color: CHART.ok, label: "1m" },
  { y: 3, color: CHART.warn, label: "3m — P2" },
  { y: 5, color: CHART.orange, label: "5m — P1" },
  { y: 7, color: CHART.danger, label: "7m" },
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
      setError("Failed to load water level data");
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
    <div className="card lg:col-span-3">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="card-title">
          <Droplets className="size-4 text-accent" aria-hidden="true" />
          Water Level — 24 Hours
        </h3>
        {current !== undefined && (
          <span className="pill bg-accent/10 font-mono text-accent ring-accent/40">Current: {current.toFixed(2)} m</span>
        )}
      </div>

      {loading && data.length === 0 ? (
        <div className="flex h-64 w-full items-center justify-center sm:h-80">
          <div className="flex flex-col items-center gap-2">
            <div className="size-8 rounded-full border-4 border-accent border-t-transparent animate-spin" />
            <span className="text-xs text-muted">Loading chart data…</span>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-64 w-full items-center justify-center sm:h-80">
          <span className={`text-xs ${error ? "text-danger" : "text-muted"}`}>{error ?? "No water level data yet"}</span>
        </div>
      ) : (
        <div className="h-64 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} strokeOpacity={0.5} />
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
                unit="m"
              />
              <Tooltip
                formatter={formatTooltip}
                cursor={{ stroke: CHART.tick, strokeOpacity: 0.4 }}
                contentStyle={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  color: "var(--color-fg)",
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--color-muted)" }}
                itemStyle={{ color: "var(--color-fg)" }}
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
    </div>
  );
}
