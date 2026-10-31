"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
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

function Shell({ gate, isAdmin, children }: { gate: Gate; isAdmin: boolean; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-surface">
        <DashboardHeaderClient gateName={gate.name} isAdmin={isAdmin} />
      </header>
      {children}
      <footer className="border-t border-border py-3 text-center">
        <p className="text-xs text-muted">Water Gate Way</p>
      </footer>
    </div>
  );
}

/** Status strip under the app bar: connection state, gate name, clock. */
function StatusStrip({ gateName, stale, now }: { gateName: string; stale: boolean; now: number | null }) {
  const clock =
    now === null ? "" : new Date(now).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (
    <div className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2.5 text-sm sm:px-6 lg:px-8">
        <span className={`inline-flex items-center gap-2 font-bold ${stale ? "text-danger" : "text-on"}`}>
          <span className={`size-2.5 rounded-full ${stale ? "bg-danger" : "bg-on"}`} aria-hidden="true" />
          {stale ? "ขาดการเชื่อมต่อ" : "ออนไลน์"}
        </span>
        <span className="text-muted">{gateName}</span>
        <span className="ml-auto text-muted">{clock}</span>
      </div>
    </div>
  );
}

function LiveDashboard({ gate, role }: Props) {
  const now = useNow();
  const { status, conn } = useGateStatus();
  const stale = now === null || isStale(status, conn, now);
  const live = !stale;

  return (
    <Shell gate={gate} isAdmin={role === "admin"}>
      <StatusStrip gateName={gate.name} stale={stale} now={now} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className={`grid grid-cols-1 gap-6 ${role !== "viewer" ? "lg:grid-cols-[minmax(0,1fr)_400px]" : ""}`}>
          {/* Control column: first on mobile, sticky 400px on the right on desktop. Viewer gets none. */}
          {role !== "viewer" && (
            <aside className="order-1 min-w-0 lg:order-2">
              <div className="flex flex-col gap-4 lg:sticky lg:top-20">
                {/* The one soft shadow in the design: the sticky control column only. */}
                <div className="rounded-lg shadow-[0_1px_2px_rgb(20_32_41/0.06),0_4px_12px_rgb(20_32_41/0.05)]">
                  <ControlPanel devices={status?.devices ?? null} stale={stale} />
                </div>
                <a
                  id="download-graph-data"
                  href="/api/water-level/download"
                  download="water_levels_report.csv"
                  className="btn-secondary w-full"
                >
                  <Download className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  ดาวน์โหลดข้อมูลระดับน้ำ (CSV)
                </a>
              </div>
            </aside>
          )}

          {/* Main column. Mobile: cameras → readings → chart; desktop: cameras → chart → readings. */}
          <div className="order-2 flex min-w-0 flex-col gap-6 lg:order-1">
            <CameraGrid />

            <section
              id="sensor-grid"
              aria-labelledby="readings-heading"
              className="order-2 rounded-lg border border-border bg-surface lg:order-3"
            >
              <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-border px-4 py-3 sm:px-5">
                <h2 id="readings-heading" className="text-base font-bold text-fg">
                  ค่าที่วัดได้
                </h2>
                {!live && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted">
                    <span className="size-2 rounded-full border-2 border-dashed border-unknown" aria-hidden="true" />
                    ข้อมูลไม่เป็นปัจจุบัน
                  </span>
                )}
              </header>
              <div className="divide-y divide-border px-4 py-2 sm:px-5">
                <div className="py-3">
                  <ElectricCard pzem={status?.pzem ?? null} live={live} />
                </div>
                <div className="py-3">
                  <RadarCard radar={status?.radar ?? null} live={live} />
                </div>
                <div className="py-3">
                  <FloatSwitchCard float={status?.float ?? null} live={live} />
                </div>
                <div className="py-3">
                  <WireBreakCard wireBreak={status?.wireBreak ?? null} live={live} />
                </div>
                <div className="py-3">
                  <DetectionCard personCount={status?.personCount ?? null} live={live} />
                </div>
              </div>
            </section>

            <div className="order-3 lg:order-2">
              <WaterLevelChart />
            </div>
          </div>
        </div>
      </main>
    </Shell>
  );
}

function NoDevice({ gate, role }: { gate: Gate; role: SessionUser["role"] }) {
  return (
    <Shell gate={gate} isAdmin={role === "admin"}>
      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="text-center">
          <p className="text-lg font-bold text-fg">ประตูนี้ยังไม่ได้ติดตั้งอุปกรณ์</p>
          <p className="mt-1 text-sm text-muted">{gate.name} ยังไม่มีเซนเซอร์หรือกล้อง</p>
          <Link href="/" className="btn-secondary mt-5">
            กลับไปแผนที่
          </Link>
        </div>
      </main>
    </Shell>
  );
}

export default function DashboardClient({ gate, role }: Props) {
  // WHY: gates without hardware never open the telemetry stream or camera sessions.
  return gate.hasDevice ? <LiveDashboard gate={gate} role={role} /> : <NoDevice gate={gate} role={role} />;
}
