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

function Shell({
  gate,
  now,
  stale,
  isAdmin,
  children,
}: {
  gate: Gate;
  now: number | null;
  stale: boolean;
  isAdmin: boolean;
  children: ReactNode;
}) {
  const clock =
    now === null ? "" : new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <DashboardHeaderClient gateName={gate.name} clock={clock} stale={stale} isAdmin={isAdmin} />
      </header>
      {children}
      <footer className="border-t border-border bg-surface py-3 text-center">
        <p className="text-xs text-muted">
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
    <Shell gate={gate} now={now} stale={stale} isAdmin={role === "admin"}>
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
            {role !== "viewer" && (
              <section aria-labelledby="controls-heading" className="flex flex-col gap-4">
                <h2 id="controls-heading" className="card-title px-1">
                  Controls
                </h2>
                <ControlPanel devices={status?.devices ?? null} stale={stale} />
              </section>
            )}
            <a
              id="download-graph-data"
              href="/api/water-level/download"
              download="water_levels_report.csv"
              className="btn-secondary w-full"
            >
              <Download className="size-5" aria-hidden="true" />
              Download Graph Data
            </a>
          </div>
        </section>
      </main>
    </Shell>
  );
}

function NoDevice({ gate, role }: { gate: Gate; role: SessionUser["role"] }) {
  const now = useNow();
  return (
    <Shell gate={gate} now={now} stale isAdmin={role === "admin"}>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-center">
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <h2 className="text-lg font-semibold text-fg">No device installed</h2>
          <p className="text-sm text-muted mt-1">{gate.name} has no sensors or cameras yet.</p>
        </div>
      </main>
    </Shell>
  );
}

export default function DashboardClient({ gate, role }: Props) {
  // WHY: gates without hardware never open the telemetry stream or camera sessions.
  return gate.hasDevice ? <LiveDashboard gate={gate} role={role} /> : <NoDevice gate={gate} role={role} />;
}
