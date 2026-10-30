"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
import DashboardHeaderClient from "@/components/DashboardHeaderClient";
import { useGateStatus } from "@/hooks/useGateStatus";
import { isStale } from "@/lib/telemetry/stale";
import type { Gate } from "@/lib/gates";
import type { SessionUser } from "@/lib/auth/session";
import CameraGrid from "./_components/CameraGrid";
import ElectricCard from "./_components/ElectricCard";
import RadarCard from "./_components/RadarCard";
import FloatSwitchCard from "./_components/FloatSwitchCard";
import WireBreakCard from "./_components/WireBreakCard";
import WaterLevelChart from "./_components/WaterLevelChart";
import DetectionCard from "./_components/DetectionCard";
import ControlPanel from "./_components/ControlPanel";

type Props = { gate: Gate; role: SessionUser["role"] };

/** Wall-clock ms, ticking every second; null until mounted (avoids a server/client clock mismatch). */
function useNow(): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Shell({ gate, now, stale, children }: { gate: Gate; now: number | null; stale: boolean; children: ReactNode }) {
  const clock =
    now === null ? "" : new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-yellow-400 shadow-md">
        <DashboardHeaderClient gateName={gate.name} clock={clock} stale={stale} />
      </header>
      {children}
      <footer className="bg-gray-100 border-t border-gray-200 py-3 text-center">
        <p className="text-xs text-gray-400">
          © {new Date().getFullYear()} Irrigation Department — Water Gate Management System
        </p>
      </footer>
    </div>
  );
}

function LiveDashboard({ gate, role }: Props) {
  const now = useNow();
  const { status, conn } = useGateStatus();
  const stale = now === null || isStale(status, conn, now);
  const live = !stale;
  // WHY: stale cards keep the last values but greyed, so an old reading is never mistaken for a live one.
  const dim = stale ? "opacity-50" : "";

  return (
    <Shell gate={gate} now={now} stale={stale}>
      <CameraGrid />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <section id="sensor-grid" className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 transition-opacity ${dim}`}>
          <ElectricCard pzem={status?.pzem ?? null} live={live} />
          <RadarCard radar={status?.radar ?? null} live={live} />
          <FloatSwitchCard float={status?.float ?? null} live={live} />
          <WireBreakCard wireBreak={status?.wireBreak ?? null} live={live} />
        </section>

        <section id="graph-and-controls" className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <WaterLevelChart />
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className={`transition-opacity ${dim}`}>
              <DetectionCard personCount={status?.personCount ?? null} />
            </div>
            {role !== "viewer" && <ControlPanel devices={status?.devices ?? null} />}
            <a
              id="download-graph-data"
              href="/api/water-level/download"
              download="water_levels_report.csv"
              className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 active:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-green-500/25 transition-all duration-200"
            >
              <Download className="w-5 h-5" />
              Download Graph Data
            </a>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function NoDevice({ gate }: { gate: Gate }) {
  const now = useNow();
  return (
    <Shell gate={gate} now={now} stale>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
          <h2 className="text-lg font-bold text-gray-700">No device installed</h2>
          <p className="text-sm text-gray-400 mt-1">{gate.name} has no sensors or cameras yet.</p>
        </div>
      </main>
    </Shell>
  );
}

export default function DashboardClient({ gate, role }: Props) {
  // WHY: gates without hardware never open the telemetry stream or camera sessions.
  return gate.hasDevice ? <LiveDashboard gate={gate} role={role} /> : <NoDevice gate={gate} />;
}
