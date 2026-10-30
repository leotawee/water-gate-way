"use client";

import Go2RTCPlayer from "@/components/Go2RTCPlayer";
import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import DashboardHeaderClient from "@/components/DashboardHeaderClient";
import { useMqtt } from "@/hooks/useMqtt";
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
import {
  Fan,
  Download,
  Droplets,
  Zap,
  Activity,
  Bell,
  Lightbulb,
  Power,
  ScanLine,
  Waves,
  Radio,

} from "lucide-react";

/* ─────────────────────────── types ─────────────────────────── */
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

/* ── types for dynamic sensor data (Pi + STM32 via FastAPI WS) ── */
interface PhaseData {
  voltage: number;
  current: number;
  power: number;
}

interface WireStatus {
  red: boolean; // true = broken
  blue: boolean; // true = broken
}

/* ── STM32 flat-format sensor types (from stm32/status/all) ── */
interface PzemData {
  v: number;   // voltage
  i: number;   // current
  freq: number; // frequency
}

interface RadarData {
  liquid: number; // water level (m)
  air: number;    // air gap (m)
}

interface FloatData {
  f1: boolean;
  f2: boolean;
  f3: boolean;
}

/* ── device status tracked locally for UI feedback ── */
interface DeviceStatus {
  pump: boolean;
  alarm: boolean;
  light: boolean;
  relay1: boolean;
  relay2: boolean;
}

/* ── FastAPI endpoints ── */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "wss://map.hyxc.io/ws/detections";
const CONTROL_API = `${API_BASE}/api/control`; // HTTP fallback when MQTT is offline

/* ─────────────── helper: map API rows to chart data ─────────────── */
function mapApiToChart(rows: ApiWaterLevel[]): DataPoint[] {
  return rows.map((row) => ({
    time: new Date(row.measured_at).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    level: Number(row.water_height),
  }));
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  /* ── client-side gate ── */
  const [isClient, setIsClient] = useState(false);

  /* ── water level state ── */
  const [data, setData] = useState<DataPoint[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number>(0);
  const [clock, setClock] = useState<string>("");
  const dataRef = useRef<DataPoint[]>([]);

  /* ── dynamic sensor state (fed by FastAPI WebSocket) ── */
  const [phases, setPhases] = useState<PhaseData[]>([
    { voltage: 0, current: 0, power: 0 },
    { voltage: 0, current: 0, power: 0 },
    { voltage: 0, current: 0, power: 0 },
  ]);

  const [wireStatus, setWireStatus] = useState<WireStatus>({
    red: false,
    blue: false,
  });

  /* ── STM32 sensor state (from stm32/status/all) ── */
  const [pzem, setPzem] = useState<PzemData>({ v: 0, i: 0, freq: 0 });
  const [radar, setRadar] = useState<RadarData>({ liquid: 0, air: 0 });
  const [floatSwitches, setFloatSwitches] = useState<FloatData>({
    f1: false,
    f2: false,
    f3: false,
  });

  /* ── AI / person detection state ── */
  const [personCount, setPersonCount] = useState<number>(0);
  const [aiModeText, setAiModeText] = useState<string>("ไม่มีคน");

  /* ── hardware control state (local feedback) ── */
  const [devices, setDevices] = useState<DeviceStatus>({
    pump: false,
    alarm: false,
    light: false,
    relay1: false,
    relay2: false,
  });

  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [sending, setSending] = useState<boolean>(false);

  /* ── MQTT (primary transport) ── */
  const { connState: mqttConnState, connected: mqttConnected, statusData: mqttStatus, publish: mqttPublish } = useMqtt();

  /* ── mark client-side ── */
  useEffect(() => {
    setIsClient(true);
  }, []);

  /* ── fetch water levels from API ── */
  const fetchWaterLevels = useCallback(async () => {
    try {
      const res = await fetch("/api/water-level");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows: ApiWaterLevel[] = await res.json();
      if (!Array.isArray(rows)) throw new Error("Response is not an array");
      const chartData = mapApiToChart(rows);
      setData(chartData);
      dataRef.current = chartData;
      setDataError(null);
      if (chartData.length > 0) {
        setCurrentLevel(chartData[chartData.length - 1].level);
      }
    } catch (err) {
      // WHY: clear stale points so the chart never shows data we failed to refresh
      console.error("[Dashboard] Failed to fetch water levels:", err);
      setData([]);
      dataRef.current = [];
      setDataError("Failed to load water level data");
    } finally {
      setDataLoading(false);
    }
  }, []);

  /* ── initial fetch + polling every 5 minutes ── */
  useEffect(() => {
    fetchWaterLevels();
    const interval = setInterval(fetchWaterLevels, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchWaterLevels]);

  /* ── command sender: MQTT primary, HTTP fallback ── */
  const sendCommand = useCallback(
    async (cmd: string, updateLocal?: Partial<DeviceStatus>) => {
      // Sanitize locally before any transmission
      const clean = cmd.trim().toUpperCase();
      if (clean.length !== 2) {
        console.warn(`[Control] REJECTED bad length: "${clean}"`);
        return;
      }
      const valid = new Set(["P1","P0","A1","A0","L1","L0","M1","M0","R1","R0","Q1","Q0"]);
      if (!valid.has(clean)) {
        console.warn(`[Control] REJECTED invalid cmd: "${clean}"`);
        return;
      }

      setSending(true);
      try {
        // 1) Try MQTT first — must succeed before updating UI
        if (mqttConnected) {
          const ok = mqttPublish(clean);
          if (ok) {
            console.log(`[Control] Sent "${clean}" via MQTT`);
            if (updateLocal) setDevices((prev) => ({ ...prev, ...updateLocal }));
          } else {
            console.warn(`[Control] MQTT publish rejected "${clean}"`);
          }
          return;
        }
        // 2) Fallback HTTP
        const res = await fetch(CONTROL_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: clean }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        console.log(`[Control] Sent "${clean}" via HTTP`);
        if (updateLocal) setDevices((prev) => ({ ...prev, ...updateLocal }));
      } catch (err) {
        console.error(`[Control] Failed to send "${clean}":`, err);
      } finally {
        setSending(false);
      }
    },
    [mqttConnected, mqttPublish]
  );

  /* ── WebSocket: real-time unified feed from ai-receiver ── */
  useEffect(() => {
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log("[WS] Connected to AI Receiver");
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // Ignore server keep-alive pings
        if (msg.type === "ping") return;

        /* ── Person count / AI Mode ──
           Backend sends M1 to STM32 when person_count > 0,
           and M0 when count == 0.  We mirror that logic here
           for the UI text display. */
        if (typeof msg.person_count === "number") {
          setPersonCount(msg.person_count);
          setAiModeText(msg.person_count > 0 ? "เจอคน" : "ไม่มีคน");
        }

        // Also support explicit mode strings from backend if echoed
        if (msg.command === "M1") setAiModeText("เจอคน");
        if (msg.command === "M0") setAiModeText("ไม่มีคน");

        // STM32 sensor data (legacy format from ai-receiver)
        if (msg.stm32) {
          const s = msg.stm32;

          if (s.WireBreak !== undefined) {
            setWireStatus((prev) => ({
              ...prev,
              red: Boolean(s.WireBreak),
            }));
          }

          if (s.PZEM) {
            setPhases((prev) => [
              {
                voltage: Number(s.PZEM.voltage ?? prev[0].voltage),
                current: Number(s.PZEM.current ?? prev[0].current),
                power: Number(s.PZEM.power ?? prev[0].power),
              },
              prev[1],
              prev[2],
            ]);
            // Also feed PZEM card
            setPzem({
              v: Number(s.PZEM.voltage ?? 0),
              i: Number(s.PZEM.current ?? 0),
              freq: Number(s.PZEM.frequency ?? 0),
            });
          }

          if (s.Radar) {
            setRadar({
              liquid: Number(s.Radar.distance ?? 0),
              air: Number(s.Radar.air ?? s.Radar.distance ?? 0),
            });
          }

          if (s.Floats) {
            setFloatSwitches({
              f1: Boolean(s.Floats.upper),
              f2: Boolean(s.Floats.lower),
              f3: Boolean(s.Floats.f3 ?? false),
            });
          }
        }
      } catch (err) {
        console.error("[WS] Parse error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("[WS] Error:", err);
      setWsConnected(false);
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected");
      setWsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  /* ── MQTT status feed (overrides / supplements WebSocket) ── */
  useEffect(() => {
    if (!mqttStatus) return;

    // ── Support BOTH data formats ──
    // Format A (from ai-receiver/main.py): { stm32: { PZEM, WireBreak, ... } }
    // Format B (from stm32/status/all):   { pzem, radar, float, wirebreak, pump, alarm }
    const legacy = mqttStatus.stm32 as Record<string, unknown> | undefined;
    const flat = mqttStatus as Record<string, unknown>;

    // ── WireBreak ──
    if (legacy?.WireBreak !== undefined) {
      setWireStatus((prev) => ({ ...prev, red: Boolean(legacy.WireBreak) }));
    } else if (flat.wirebreak) {
      const wb = flat.wirebreak as Record<string, boolean>;
      setWireStatus({ red: Boolean(wb.wb1), blue: Boolean(wb.wb2) });
    }

    // ── PZEM / Electric ──
    if (legacy?.PZEM) {
      const pzemData = legacy.PZEM as Record<string, number>;
      setPhases((prev) => [
        {
          voltage: Number(pzemData.voltage ?? prev[0].voltage),
          current: Number(pzemData.current ?? prev[0].current),
          power: Number(pzemData.power ?? prev[0].power),
        },
        prev[1],
        prev[2],
      ]);
      setPzem({
        v: Number(pzemData.voltage ?? 0),
        i: Number(pzemData.current ?? 0),
        freq: Number(pzemData.frequency ?? 0),
      });
    } else if (flat.pzem) {
      const pzemData = flat.pzem as Record<string, number>;
      setPhases((prev) => [
        {
          voltage: Number(pzemData.v ?? pzemData.voltage ?? prev[0].voltage),
          current: Number(pzemData.i ?? pzemData.current ?? prev[0].current),
          power: Number(pzemData.p ?? pzemData.power ?? prev[0].power),
        },
        prev[1],
        prev[2],
      ]);
      setPzem({
        v: Number(pzemData.v ?? pzemData.voltage ?? 0),
        i: Number(pzemData.i ?? pzemData.current ?? 0),
        freq: Number(pzemData.freq ?? pzemData.frequency ?? 0),
      });
    }

    // ── Radar / Water Level ──
    if (legacy?.Radar) {
      const r = legacy.Radar as Record<string, number>;
      setRadar({
        liquid: Number(r.distance ?? 0),
        air: Number(r.air ?? r.distance ?? 0),
      });
    } else if (flat.radar) {
      const r = flat.radar as Record<string, number>;
      setRadar({
        liquid: Number(r.liquid ?? r.distance ?? 0),
        air: Number(r.air ?? 0),
      });
    }

    // ── Float Switch ──
    if (legacy?.Floats) {
      const f = legacy.Floats as Record<string, boolean>;
      setFloatSwitches({
        f1: Boolean(f.upper),
        f2: Boolean(f.lower),
        f3: Boolean(f.f3 ?? false),
      });
    } else if (flat.float) {
      const f = flat.float as Record<string, boolean>;
      setFloatSwitches({
        f1: Boolean(f.f1),
        f2: Boolean(f.f2),
        f3: Boolean(f.f3 ?? false),
      });
    }
  }, [mqttStatus]);

  /* ── download CSV via backend API ── */
  const downloadCSV = useCallback(() => {
    const a = document.createElement("a");
    a.href = "/api/water-level/download";
    a.download = "water_levels_report.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

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
  const formatTooltip = (
    value: TooltipValueType | undefined,
    _name: number | string | undefined
  ): [string, string] => {
    const raw = Array.isArray(value) ? value[0] : value;
    const num = typeof raw === "number" ? raw : Number(raw ?? 0);
    return [`${num.toFixed(2)} m`, "Water Level"];
  };

  /* ═══════════════ LOADING STATE ═══════════════ */
  if (!isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500 font-medium">
            Loading Dashboard…
          </span>
        </div>
      </div>
    );
  }

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ─────────── HEADER ─────────── */}
      <header className="bg-yellow-400 shadow-md">
        <Suspense
          fallback={
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-700/20 rounded-full animate-pulse" />
                <div>
                  <div className="w-32 h-6 bg-gray-300/60 rounded animate-pulse" />
                  <div className="w-48 h-4 bg-gray-300/40 rounded mt-1 animate-pulse" />
                </div>
              </div>
              <span className="text-xs sm:text-sm font-bold bg-white/80 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-gray-900">
                📍 Unknown Gate
              </span>
            </div>
          }
        >
          <DashboardHeaderClient clock={clock} />
        </Suspense>
      </header>

      {/* ── SECTION: Camera Monitors (go2rtc WebRTC P2P) ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full pt-6">
        {[
          { src: "office1", label: "Office-1" },
          { src: "office2", label: "Office-2" },
          { src: "office3", label: "Office-3" },
        ].map(({ src, label }) => (
          <div
            key={src}
            id={`camera-stream-${src}`}
            className="aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-800 bg-black"
          >
            <Go2RTCPlayer streamName={src} label={label} />
          </div>
        ))}
      </section>

      {/* ─────────── MAIN CONTENT ─────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ── SECTION: STM32 Sensor Grid ── */}
        <section
          id="sensor-grid"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
        >
          {/* ── Card 1: PZEM Electric ⚡ ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                  PZEM — Electric
                </h3>
              </div>
              <Activity
                className={`w-4 h-4 ${
                  mqttConnState === "connected"
                    ? "text-green-500"
                    : "text-gray-300"
                }`}
              />
            </div>

            <div className="space-y-3">
              {/* Voltage */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-50 border border-yellow-100">
                <span className="text-sm font-semibold text-gray-600">Voltage</span>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-yellow-600 font-mono">
                    {pzem.v > 0 ? pzem.v.toFixed(1) : "—"}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">Volts</div>
                </div>
              </div>
              {/* Current */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-100">
                <span className="text-sm font-semibold text-gray-600">Current</span>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-orange-600 font-mono">
                    {pzem.i > 0 ? pzem.i.toFixed(2) : "—"}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">Amps</div>
                </div>
              </div>
              {/* Frequency */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
                <span className="text-sm font-semibold text-gray-600">Frequency</span>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-blue-600 font-mono">
                    {pzem.freq > 0 ? pzem.freq.toFixed(2) : "—"}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">Hz</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Card 2: Radar Water Level 📡 ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-500" />
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                  Radar — Water Level
                </h3>
              </div>
              <Activity
                className={`w-4 h-4 ${
                  mqttConnState === "connected"
                    ? "text-green-500"
                    : "text-gray-300"
                }`}
              />
            </div>

            <div className="space-y-3">
              {/* Liquid Level */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-cyan-50 border border-cyan-100">
                <span className="text-sm font-semibold text-gray-600">Liquid</span>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-cyan-600 font-mono">
                    {radar.liquid > 0 ? radar.liquid.toFixed(3) : "—"}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">meters</div>
                </div>
              </div>
              {/* Air Gap */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-sky-50 border border-sky-100">
                <span className="text-sm font-semibold text-gray-600">Air Gap</span>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-sky-600 font-mono">
                    {radar.air > 0 ? radar.air.toFixed(3) : "—"}
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium">meters</div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Card 3: Float Switch 🌊 ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Waves className="w-5 h-5 text-indigo-500" />
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                  Float Switch
                </h3>
              </div>
              <Activity
                className={`w-4 h-4 ${
                  mqttConnState === "connected"
                    ? "text-green-500"
                    : "text-gray-300"
                }`}
              />
            </div>

            <div className="space-y-3">
              {/* F1 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-sm font-semibold text-gray-700">F1 — Upper</span>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      floatSwitches.f1 ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      floatSwitches.f1
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {floatSwitches.f1 ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
              {/* F2 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-sm font-semibold text-gray-700">F2 — Lower</span>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      floatSwitches.f2 ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      floatSwitches.f2
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {floatSwitches.f2 ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
              {/* F3 */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <span className="text-sm font-semibold text-gray-700">F3</span>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      floatSwitches.f3 ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      floatSwitches.f3
                        ? "bg-green-100 text-green-600"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {floatSwitches.f3 ? "ON" : "OFF"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Card 4: Wire Break 🔌 ── */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                Wire Break
              </h3>
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    wsConnected ? "bg-green-500" : "bg-gray-300"
                  }`}
                />
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  {wsConnected ? "Live" : "Offline"}
                </span>
                <div
                  className={`w-2 h-2 rounded-full ml-1 ${
                    mqttConnState === "connected"
                      ? "bg-blue-500"
                      : mqttConnState === "connecting"
                      ? "bg-yellow-400 animate-pulse"
                      : mqttConnState === "error"
                      ? "bg-red-500"
                      : "bg-gray-300"
                  }`}
                />
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                  {mqttConnState === "connected"
                    ? "MQTT"
                    : mqttConnState === "connecting"
                    ? "MQTT..."
                    : mqttConnState === "error"
                    ? "MQTT!"
                    : "noMQTT"}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Red Wire (WB1) */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full bg-red-500" />
                  <span className="text-sm font-semibold text-gray-700">
                    Red (WB1)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      wireStatus.red
                        ? "bg-red-500 animate-pulse"
                        : "bg-green-500"
                    }`}
                  />
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      wireStatus.red
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                    }`}
                  >
                    {wireStatus.red ? "BROKEN" : "NORMAL"}
                  </span>
                </div>
              </div>

              {/* Blue Wire (WB2) */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-8 rounded-full bg-blue-500" />
                  <span className="text-sm font-semibold text-gray-700">
                    Blue (WB2)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      wireStatus.blue
                        ? "bg-red-500 animate-pulse"
                        : "bg-green-500"
                    }`}
                  />
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      wireStatus.blue
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                    }`}
                  >
                    {wireStatus.blue ? "BROKEN" : "NORMAL"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION: Water Level Graph + Control Panel ── */}
        <section
          id="graph-and-controls"
          className="grid grid-cols-1 lg:grid-cols-5 gap-4"
        >
          {/* Left: Water Level Graph (takes 3/5 on desktop) */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-blue-500" />
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">
                  Water Level — 24 Hours
                </h3>
              </div>
              {data.length > 0 && (
                <span className="text-xs bg-blue-50 text-blue-600 font-bold px-3 py-1 rounded-full">
                  Current: {currentLevel.toFixed(2)} m
                </span>
              )}
            </div>

            {dataLoading && data.length === 0 ? (
              <div className="w-full h-64 sm:h-80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-400">Loading chart data…</span>
                </div>
              </div>
            ) : data.length === 0 ? (
              <div className="w-full h-64 sm:h-80 flex items-center justify-center">
                <span className={`text-xs ${dataError ? "text-red-500" : "text-gray-400"}`}>
                  {dataError ?? "No water level data yet"}
                </span>
              </div>
            ) : (
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
            )}
          </div>

          {/* Right: Control Panel (takes 2/5 on desktop) */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* ── AI Detection Status ── */}
            <div
              className={`rounded-2xl border-2 p-5 text-center transition-all duration-300 ${
                personCount > 0
                  ? "bg-orange-50 border-orange-200 shadow-md shadow-orange-500/10"
                  : "bg-green-50 border-green-200"
              }`}
            >
              <ScanLine
                className={`w-8 h-8 mx-auto mb-2 ${
                  personCount > 0 ? "text-orange-500" : "text-green-500"
                }`}
              />
              <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-1">
                AI Detection
              </h3>
              <div
                className={`text-3xl font-extrabold ${
                  personCount > 0 ? "text-orange-600" : "text-green-600"
                }`}
              >
                {aiModeText}
              </div>
              {personCount > 0 && (
                <div className="text-xs text-orange-500 mt-1 animate-pulse font-medium">
                  Person detected! ({personCount})
                </div>
              )}
              <div className="mt-2 text-[10px] text-gray-400">
                Mode: {personCount > 0 ? "M1" : "M0"}
              </div>
            </div>

            {/* ── Pump Control ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Fan className="w-5 h-5 text-blue-500" />
                  <h4 className="font-bold text-gray-800">Pump Control</h4>
                </div>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    devices.pump
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {devices.pump ? "ON" : "OFF"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => sendCommand("P1", { pump: true })}
                  disabled={sending}
                  className="py-2.5 rounded-xl text-sm font-bold bg-blue-500 text-white shadow-md shadow-blue-500/25 hover:bg-blue-600 active:bg-blue-700 transition-all duration-200 disabled:opacity-50"
                >
                  เปิดปั๊มปกติ
                </button>
                <button
                  onClick={() => sendCommand("P0", { pump: false })}
                  disabled={sending}
                  className="py-2.5 rounded-xl text-sm font-bold bg-red-500 text-white shadow-md shadow-red-500/25 hover:bg-red-600 active:bg-red-700 transition-all duration-200 disabled:opacity-50"
                >
                  ปิดปั๊มปกติ
                </button>
              </div>
            </div>

            {/* ── Alarm & Light ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h4 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wider">
                Alarm & Light
              </h4>
              <div className="space-y-3">
                {/* Alarm */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell
                      className={`w-4 h-4 ${
                        devices.alarm ? "text-red-500" : "text-gray-400"
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Alarm
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        devices.alarm
                          ? "bg-red-100 text-red-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {devices.alarm ? "ON" : "OFF"}
                    </span>
                    <button
                      onClick={() => sendCommand("A1", { alarm: true })}
                      disabled={sending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500 text-white hover:bg-red-600 active:bg-red-700 transition-all disabled:opacity-50"
                    >
                      เปิด Alarm
                    </button>
                    <button
                      onClick={() => sendCommand("A0", { alarm: false })}
                      disabled={sending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all disabled:opacity-50"
                    >
                      ปิด Alarm
                    </button>
                  </div>
                </div>

                {/* Light */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb
                      className={`w-4 h-4 ${
                        devices.light ? "text-yellow-500" : "text-gray-400"
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Light
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        devices.light
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {devices.light ? "ON" : "OFF"}
                    </span>
                    <button
                      onClick={() => sendCommand("L1", { light: true })}
                      disabled={sending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700 transition-all disabled:opacity-50"
                    >
                      เปิดไฟ
                    </button>
                    <button
                      onClick={() => sendCommand("L0", { light: false })}
                      disabled={sending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all disabled:opacity-50"
                    >
                      ปิดไฟ
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── IoT Relay Pumps ── */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <h4 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wider">
                IoT Relay Pumps
              </h4>
              <div className="space-y-3">
                {/* Relay 1 (IoT Pump 1) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Power
                      className={`w-4 h-4 ${
                        devices.relay1 ? "text-green-500" : "text-gray-400"
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      IoT Pump 1
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        devices.relay1
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {devices.relay1 ? "ON" : "OFF"}
                    </span>
                    <button
                      onClick={() => sendCommand("R1", { relay1: true })}
                      disabled={sending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition-all disabled:opacity-50"
                    >
                      เปิด
                    </button>
                    <button
                      onClick={() => sendCommand("R0", { relay1: false })}
                      disabled={sending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all disabled:opacity-50"
                    >
                      ปิด
                    </button>
                  </div>
                </div>

                {/* Relay 2 (IoT Pump 2) */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Power
                      className={`w-4 h-4 ${
                        devices.relay2 ? "text-green-500" : "text-gray-400"
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-700">
                      IoT Pump 2
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        devices.relay2
                          ? "bg-green-100 text-green-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {devices.relay2 ? "ON" : "OFF"}
                    </span>
                    <button
                      onClick={() => sendCommand("Q1", { relay2: true })}
                      disabled={sending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 text-white hover:bg-green-600 active:bg-green-700 transition-all disabled:opacity-50"
                    >
                      เปิด
                    </button>
                    <button
                      onClick={() => sendCommand("Q0", { relay2: false })}
                      disabled={sending}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all disabled:opacity-50"
                    >
                      ปิด
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Download CSV ── */}
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
