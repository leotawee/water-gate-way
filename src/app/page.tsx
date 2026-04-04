"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  Fan,
  Download,
  Droplets,
  Zap,
  Monitor,
  Activity,
  ChevronDown,
} from "lucide-react";

/* ─────────────────────────── types ─────────────────────────── */
interface DataPoint {
  time: string;
  level: number;
}

interface PumpState {
  on: boolean;
  mode: "auto" | "manual";
}

/* ─────────────────── helper: generate mock data ─────────────── */
function generateInitialData(): DataPoint[] {
  const now = new Date();
  const arr: DataPoint[] = [];
  for (let i = 60; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 60_000);
    arr.push({
      time: t.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      level: parseFloat((Math.random() * 5 + 1).toFixed(2)),
    });
  }
  return arr;
}

/* ═══════════════════════════════════════════════════════════════
   PUMP CARD COMPONENT
   ═══════════════════════════════════════════════════════════════ */
interface PumpCardProps {
  id: string;
  label: string;
  pump: PumpState;
  onToggleMode: () => void;
  onTurnOn: () => void;
  onTurnOff: () => void;
}

function PumpCard({
  id,
  label,
  pump,
  onToggleMode,
  onTurnOn,
  onTurnOff,
}: PumpCardProps) {
  return (
    <div
      id={id}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className={`p-2.5 rounded-xl ${
              pump.on ? "bg-blue-50" : "bg-gray-100"
            }`}
          >
            <Fan
              className={`w-7 h-7 transition-all duration-500 ${
                pump.on ? "text-blue-500 animate-spin" : "text-gray-400"
              }`}
              style={pump.on ? { animationDuration: "1.5s" } : undefined}
            />
          </div>
          <div>
            <h4 className="font-bold text-gray-800 text-base">
              Pump {label}
            </h4>
            <span
              className={`text-xs font-semibold ${
                pump.on ? "text-blue-500" : "text-gray-400"
              }`}
            >
              {pump.on ? "● RUNNING" : "○ STOPPED"}
            </span>
          </div>
        </div>

        <button
          id={`${id}-mode-toggle`}
          onClick={onToggleMode}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
            pump.mode === "auto"
              ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
          }`}
        >
          {pump.mode === "auto" ? "AUTO" : "MANUAL"}
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          id={`${id}-on`}
          onClick={onTurnOn}
          disabled={pump.mode === "auto"}
          className={`py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
            pump.mode === "auto"
              ? "bg-gray-100 text-gray-300 cursor-not-allowed"
              : pump.on
              ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
              : "bg-blue-50 text-blue-500 hover:bg-blue-100"
          }`}
        >
          ON
        </button>
        <button
          id={`${id}-off`}
          onClick={onTurnOff}
          disabled={pump.mode === "auto"}
          className={`py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
            pump.mode === "auto"
              ? "bg-gray-100 text-gray-300 cursor-not-allowed"
              : !pump.on
              ? "bg-red-500 text-white shadow-md shadow-red-500/25"
              : "bg-red-50 text-red-500 hover:bg-red-100"
          }`}
        >
          OFF
        </button>
      </div>

      {pump.mode === "auto" && (
        <p className="mt-3 text-xs text-gray-400 text-center">
          ⓘ Pump is controlled automatically based on water level
        </p>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  /* ── state ── */
  const [data, setData] = useState<DataPoint[]>(() => generateInitialData());
  const [pump1, setPump1] = useState<PumpState>({ on: false, mode: "auto" });
  const [pump2, setPump2] = useState<PumpState>({ on: false, mode: "auto" });
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [toggles, setToggles] = useState<boolean[]>([false, false, false]);
  const [clock, setClock] = useState<string>("");
  const dataRef = useRef<DataPoint[]>([]);

  /* ── initialise ── */
  useEffect(() => {
    dataRef.current = data;
    if (data.length > 0) {
      setCurrentLevel(data[data.length - 1].level);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── auto-update mock data every 3s ── */
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const newLevel = parseFloat((Math.random() * 7 + 0.5).toFixed(2));
      const point: DataPoint = {
        time: now.toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        level: newLevel,
      };
      setData((prev) => {
        const next = [...prev.slice(-59), point];
        dataRef.current = next;
        return next;
      });
      setCurrentLevel(newLevel);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  /* ── auto-mode logic ── */
  const pump1Mode = pump1.mode;
  const pump2Mode = pump2.mode;

  useEffect(() => {
    if (pump1Mode === "auto") {
      setPump1((p) => {
        const shouldBeOn = currentLevel >= 5;
        if (p.on === shouldBeOn) return p;
        return { ...p, on: shouldBeOn };
      });
    }
  }, [currentLevel, pump1Mode]);

  useEffect(() => {
    if (pump2Mode === "auto") {
      setPump2((p) => {
        const shouldBeOn = currentLevel >= 3;
        if (p.on === shouldBeOn) return p;
        return { ...p, on: shouldBeOn };
      });
    }
  }, [currentLevel, pump2Mode]);

  /* ── download CSV ── */
  const downloadCSV = useCallback(() => {
    const rows = ["Time,Water Level (m)"];
    dataRef.current.forEach((d) => rows.push(`${d.time},${d.level}`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `water-level-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, []);

  /* ── toggle helper ── */
  const handleToggle = (idx: number) =>
    setToggles((t) => t.map((v, i) => (i === idx ? !v : v)));

  /* ── clock ── */
  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  
/* ── tooltip formatter ── */
// วางไว้ตรงนี้ (ประมาณบรรทัด 260)
const formatTooltip = (value: any): [string, string] => {
  const num = typeof value === "number" ? value : Number(value);
  return [`${num.toFixed(2)} m`, "Water Level"];
};

return (
  <>
    <Tooltip formatter={formatTooltip} />
    {/* วาง ReferenceLine ของนายต่อลงมาได้เลยในนี้ */}
    <ReferenceLine y={1} stroke="#22c55e" strokeDasharray="6 3" />
    <ReferenceLine y={3} stroke="#eab308" strokeDasharray="6 3" />
    <ReferenceLine y={5} stroke="#f97316" strokeDasharray="6 3" />
    <ReferenceLine y={7} stroke="#ef4444" strokeDasharray="6 3" />
  </>
);

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ─────────── HEADER ─────────── */}
      <header className="bg-yellow-400 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Droplets className="w-8 h-8 text-blue-700" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
                Water Gate 1
              </h1>
              <p className="text-xs sm:text-sm text-gray-700 font-medium">
                Irrigation Department — Real-time Monitoring
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-gray-800">
            <div className="flex items-center gap-1.5 bg-yellow-300/60 rounded-lg px-3 py-1.5">
              <Activity className="w-4 h-4 text-green-700" />
              <span className="text-xs font-semibold text-green-800">
                ONLINE
              </span>
            </div>
            <span className="text-sm font-mono font-semibold bg-yellow-300/60 rounded-lg px-3 py-1.5">
              {clock}
            </span>
          </div>
        </div>
      </header>

      {/* ─────────── MAIN CONTENT ─────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── SECTION: Video Monitors ── */}
        <section id="video-monitors">
          <div className="flex items-center gap-2 mb-3">
            <Monitor className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-800">Video Monitors</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((cam) => (
              <div
                key={cam}
                id={`video-cam-${cam}`}
                className="relative aspect-video bg-blue-400 rounded-2xl overflow-hidden shadow-lg group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-blue-800/40" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                  <Monitor className="w-10 h-10 mb-2 opacity-70 group-hover:opacity-100 transition-opacity" />
                  <span className="text-sm font-bold tracking-wide opacity-80">
                    CAM {cam}
                  </span>
                  <span className="text-xs opacity-60 mt-1">Live Feed</span>
                </div>
                <div className="absolute top-3 right-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION: Selectors & 3-Phase Electric ── */}
        <section
          id="selectors-and-electric"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Left: Toggle Buttons */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-4">
              Gate Controls
            </h3>
            <div className="flex flex-col gap-3">
              {["Gate A", "Gate B", "Gate C"].map((label, i) => (
                <button
                  key={label}
                  id={`toggle-${label.replace(" ", "-").toLowerCase()}`}
                  onClick={() => handleToggle(i)}
                  className={`flex items-center justify-between px-5 py-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
                    toggles[i]
                      ? "bg-blue-500 text-white shadow-lg shadow-blue-500/25"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      toggles[i]
                        ? "bg-white/20 text-white"
                        : "bg-gray-200 text-gray-500"
                    }`}
                  >
                    {toggles[i] ? "OPEN" : "CLOSED"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: 3-Phase Electric */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                3-Phase Electric
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  phase: "L1",
                  color: "bg-red-500",
                  voltage: 230,
                  border: "border-red-200",
                  textColor: "text-red-600",
                  bgLight: "bg-red-50",
                },
                {
                  phase: "L2",
                  color: "bg-green-500",
                  voltage: 220,
                  border: "border-green-200",
                  textColor: "text-green-600",
                  bgLight: "bg-green-50",
                },
                {
                  phase: "L3",
                  color: "bg-yellow-400",
                  voltage: 230,
                  border: "border-yellow-200",
                  textColor: "text-yellow-600",
                  bgLight: "bg-yellow-50",
                },
              ].map((p) => (
                <div
                  key={p.phase}
                  id={`phase-${p.phase.toLowerCase()}`}
                  className={`${p.bgLight} border ${p.border} rounded-xl p-4 text-center`}
                >
                  <div
                    className={`w-10 h-10 ${p.color} rounded-full mx-auto mb-2 shadow-md`}
                  />
                  <div className="text-xs font-bold text-gray-500 mb-1">
                    {p.phase}
                  </div>
                  <div
                    className={`text-2xl font-extrabold ${p.textColor} font-mono`}
                  >
                    {p.voltage}
                  </div>
                  <div className="text-xs text-gray-400 font-medium">Volts</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION: Water Level Graph + Pump Controls ── */}
        <section
          id="graph-and-pumps"
          className="grid grid-cols-1 lg:grid-cols-5 gap-4"
        >
          {/* Left: Water Level Graph (takes 3/5 on desktop) */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                  Water Level — 1 Hour
                </h3>
              </div>
              <span className="text-xs bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full">
                Current: {currentLevel.toFixed(2)} m
              </span>
            </div>

            <div className="w-full h-64 sm:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={data}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
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
                  <ReferenceLine
                    y={1}
                    stroke="#22c55e"
                    strokeDasharray="6 3"
                    label={{
                      value: "1m",
                      position: "right",
                      fill: "#22c55e",
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={3}
                    stroke="#eab308"
                    strokeDasharray="6 3"
                    label={{
                      value: "3m — P2",
                      position: "right",
                      fill: "#eab308",
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={5}
                    stroke="#f97316"
                    strokeDasharray="6 3"
                    label={{
                      value: "5m — P1",
                      position: "right",
                      fill: "#f97316",
                      fontSize: 10,
                    }}
                  />
                  <ReferenceLine
                    y={7}
                    stroke="#ef4444"
                    strokeDasharray="6 3"
                    label={{
                      value: "7m ⚠️",
                      position: "right",
                      fill: "#ef4444",
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="level"
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: "#3b82f6",
                      stroke: "#fff",
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Right: Pump Controls & Download (takes 2/5 on desktop) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <PumpCard
              id="pump-1"
              label="P1"
              pump={pump1}
              onToggleMode={() =>
                setPump1((p) => ({
                  ...p,
                  mode: p.mode === "auto" ? "manual" : "auto",
                }))
              }
              onTurnOn={() => {
                if (pump1.mode === "manual")
                  setPump1((p) => ({ ...p, on: true }));
              }}
              onTurnOff={() => {
                if (pump1.mode === "manual")
                  setPump1((p) => ({ ...p, on: false }));
              }}
            />

            <PumpCard
              id="pump-2"
              label="P2"
              pump={pump2}
              onToggleMode={() =>
                setPump2((p) => ({
                  ...p,
                  mode: p.mode === "auto" ? "manual" : "auto",
                }))
              }
              onTurnOn={() => {
                if (pump2.mode === "manual")
                  setPump2((p) => ({ ...p, on: true }));
              }}
              onTurnOff={() => {
                if (pump2.mode === "manual")
                  setPump2((p) => ({ ...p, on: false }));
              }}
            />

            <button
              id="download-graph-data"
              onClick={downloadCSV}
              className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-500/25 transition-all duration-200"
            >
              <Download className="w-5 h-5" />
              Download Graph Data
            </button>
          </div>
        </section>
      </main>

      {/* ─────────── FOOTER ─────────── */}
      <footer className="bg-gray-100 border-t border-gray-200 py-3 text-center">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Irrigation Department — Water Gate
          Management System
        </p>
      </footer>
    </div>
  );
}
