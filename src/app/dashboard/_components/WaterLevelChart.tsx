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
  { y: 1, color: "#22c55e", label: "1m" },
  { y: 3, color: "#eab308", label: "3m — P2" },
  { y: 5, color: "#f97316", label: "5m — P1" },
  { y: 7, color: "#ef4444", label: "7m ⚠️" },
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
    <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-blue-500" />
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Water Level — 24 Hours</h3>
        </div>
        {current !== undefined && (
          <span className="text-xs bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full">
            Current: {current.toFixed(2)} m
          </span>
        )}
      </div>

      {loading && data.length === 0 ? (
        <div className="w-full h-64 sm:h-80 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-gray-400">Loading chart data…</span>
          </div>
        </div>
      ) : data.length === 0 ? (
        <div className="w-full h-64 sm:h-80 flex items-center justify-center">
          <span className={`text-xs ${error ? "text-red-500" : "text-gray-400"}`}>{error ?? "No water level data yet"}</span>
        </div>
      ) : (
        <div className="w-full h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="time"
                tick={{ fontSize: 10, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={{ stroke: "#d1d5db" }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 8]}
                ticks={[0, 1, 2, 3, 4, 5, 6, 7, 8]}
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                tickLine={false}
                axisLine={{ stroke: "#d1d5db" }}
                unit="m"
              />
              <Tooltip formatter={formatTooltip} />
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
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
