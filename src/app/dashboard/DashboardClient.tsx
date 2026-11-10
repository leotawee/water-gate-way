"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Droplets, ShieldCheck } from "lucide-react";
import AppHeader, { BrandMark } from "@/components/AppHeader";
import LogoutButton from "@/components/LogoutButton";
import { useGateStatus } from "@/hooks/useGateStatus";
import { isStale } from "@/lib/telemetry/stale";
import type { Gate } from "@/lib/gates";
import type { SessionUser } from "@/lib/auth/session";
import CameraGrid from "./_components/CameraGrid";
import ElectricCard from "./_components/ElectricCard";
import FloatSwitchCard from "./_components/FloatSwitchCard";
import WireBreakCard from "./_components/WireBreakCard";
import WaterLevelChart from "./_components/WaterLevelChart";
import DetectionCard from "./_components/DetectionCard";
import ControlPanel from "./_components/ControlPanel";
import LevelGauge, { formatReceived } from "./_components/LevelGauge";
import StatePill from "@/components/StatePill";
import CardTitle from "@/components/CardTitle";
import { Button } from "@/components/ui/button";

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

const clock = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** The customer's draft: a coloured bar with the way back, the gate, its link state and a clock.
 *  WHY: the link state here is `stale` (telemetry age), never the page's own connection, so a dead feed cannot read ONLINE.
 *  The h1 is the gate; the product name is the mark beside it. */
function DashboardHeader({
  gate,
  isAdmin,
  stale,
  now,
}: {
  gate: Gate;
  isAdmin: boolean;
  stale: boolean;
  now: number | null;
}) {
  const link =
    "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-white transition-colors duration-(--dur-base) hover:bg-white/15";
  return (
    <header className="bg-brand text-white">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[1100] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-surface focus:px-3 focus:text-sm focus:font-bold focus:text-fg"
      >
        ข้ามไปยังเนื้อหา
      </a>
      <div className="mx-auto flex w-full max-w-[1680px] flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className={`${link} bg-white/15`}>
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          แผนที่
        </Link>

        <div className="flex min-w-0 flex-1 basis-56 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white">
            <BrandMark className="size-7" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold sm:text-2xl">
              {gate.name}
            </h1>
            <p className="truncate text-sm text-white/80">
              ระบบติดตามประตูน้ำแบบเรียลไทม์
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {stale ? (
            <span className="pill bg-danger-soft text-danger">
              <span
                className="size-2 rounded-full bg-danger"
                aria-hidden="true"
              />
              ขาดการเชื่อมต่อ
            </span>
          ) : (
            <span className="pill bg-white text-on">
              <span className="size-2 rounded-full bg-on" aria-hidden="true" />
              ออนไลน์
            </span>
          )}
          <span
            className="min-w-[5.5rem] rounded-xl bg-white/15 px-3 py-2 text-center text-sm font-bold tabular-nums"
            aria-label="เวลาปัจจุบัน"
          >
            {now === null ? "--:--:--" : clock.format(now)}
          </span>
          {isAdmin && (
            <Link href="/admin" className={link}>
              <ShieldCheck className="size-4" strokeWidth={1.75} aria-hidden="true" />
              ผู้ดูแลระบบ
            </Link>
          )}
          <LogoutButton
            className={`${link} cursor-pointer`}
            /* WHY: icon-only on a phone so pill, clock and both links fit one row; the word stays for screen readers. */
            labelClassName="sr-only sm:not-sr-only"
          />
        </div>
      </div>
    </header>
  );
}

function Shell({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AppHeader active={null} isAdmin={isAdmin} />
      <main
        id="main"
        className="mx-auto w-full max-w-[1376px] flex-1 px-4 pt-6 pb-12 sm:px-6 lg:px-8"
      >
        {children}
      </main>
    </div>
  );
}

const TILE =
  "min-w-0 rounded-2xl border border-border bg-surface p-5";

function LiveDashboard({ gate, role }: Props) {
  const now = useNow();
  const { status, conn } = useGateStatus();
  const stale = now === null || isStale(status, conn, now);
  const live = !stale;
  const received = formatReceived(status?.receivedAt ?? null);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <DashboardHeader
        gate={gate}
        isAdmin={role === "admin"}
        stale={stale}
        now={now}
      />
      <main
        id="main"
        className="stagger mx-auto w-full max-w-[1680px] flex-1 space-y-6 px-4 pt-6 pb-12 sm:px-6 lg:px-8"
      >
        {/* WHY: the time is the telemetry's own receivedAt, never the wall clock, so a dead feed cannot look fresh. */}
        <p className="text-sm text-muted tabular-nums">
          {received
            ? `อุปกรณ์รายงานล่าสุด ${received}`
            : "ยังไม่ได้รับข้อมูลจากอุปกรณ์"}
        </p>

        {/* Cameras stay as the customer drafted them: three dark tiles across the top. */}
        <CameraGrid />

        {/* WHY: the AI count leads the readings (a person near the gate is the alert), electric takes the tall left
            tile, floats and wire-break share the row under it. DOM order = phone order: AI, electric, floats, wire. */}
        <section aria-labelledby="readings-heading" id="sensor-grid">
          <h2 id="readings-heading" className="sr-only">
            ค่าที่วัดได้
          </h2>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] lg:grid-rows-[auto_1fr]">
            <div className="lg:col-start-2 lg:row-start-1">
              <DetectionCard personCount={status?.personCount ?? null} live={live} />
            </div>
            <div className={`${TILE} lg:col-start-1 lg:row-span-2 lg:row-start-1`}>
              <ElectricCard pzem={status?.pzem ?? null} devices={status?.devices ?? null} live={live} />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-start-2 lg:row-start-2">
              <div className={TILE}>
                <FloatSwitchCard live={live} />
              </div>
              <div className={TILE}>
                <WireBreakCard wireBreak={status?.wireBreak ?? null} live={live} />
              </div>
            </div>
          </div>
        </section>

        {/* WHY: both columns stretch to the taller one, so the water panel and the control panel end on the same line. */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
          <div className="flex min-w-0 flex-col">
            <section
              aria-labelledby="water-level-heading"
              className={`${TILE} flex flex-1 flex-col sm:p-6`}
            >
              <CardTitle id="water-level-heading" as="h2" icon={Droplets} className="mb-4 text-base">
                ระดับน้ำ
              </CardTitle>
              <div className="grid flex-1 grid-cols-1 gap-8 md:grid-cols-[auto_minmax(0,1fr)]">
                <LevelGauge
                  liquid={status?.radar.liquid ?? null}
                  airGap={status?.radar.airGap ?? null}
                  live={live}
                  receivedAt={status?.receivedAt ?? null}
                />
                <WaterLevelChart />
              </div>
            </section>
          </div>

          {/* Viewer gets the same panel read-only: state is job #1 for every role. */}
          <aside className="min-w-0">
            <ControlPanel
              devices={status?.devices ?? null}
              personCount={status?.personCount ?? null}
              mode={status?.mode ?? null}
              stale={stale}
              readOnly={role === "viewer"}
            />
          </aside>
        </div>
      </main>
    </div>
  );
}

function NoDevice({ gate, role }: { gate: Gate; role: SessionUser["role"] }) {
  return (
    <Shell isAdmin={role === "admin"}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-fg">{gate.name}</h1>
        <p className="mt-2 flex items-center gap-3 text-sm text-muted">
          <StatePill tone="off">ยังไม่ติดตั้งอุปกรณ์</StatePill>
          <span className="tabular-nums">
            พิกัด {gate.lat.toFixed(4)}, {gate.lng.toFixed(4)}
          </span>
        </p>
      </div>
      <section className="max-w-2xl rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-bold text-fg">
          ประตูนี้ยังไม่มีเซนเซอร์หรือกล้อง
        </h2>
        <p className="mt-2 text-sm text-fg">
          เมื่อติดตั้งบอร์ด STM32 และกล้องแล้ว ผู้ดูแลระบบเปิด
          &ldquo;มีอุปกรณ์&rdquo; ในหน้าจัดการประตูน้ำ หน้านี้จะแสดงระดับน้ำ
          ปุ่มควบคุม และกล้องสด
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <Link href="/">กลับไปแผนที่</Link>
          </Button>
          {role === "admin" && (
            <Button variant="outline" asChild>
              <Link href="/admin/gates">จัดการประตูน้ำ</Link>
            </Button>
          )}
        </div>
      </section>
    </Shell>
  );
}

export default function DashboardClient({ gate, role }: Props) {
  // WHY: gates without hardware never open the telemetry stream or camera sessions.
  return gate.hasDevice ? (
    <LiveDashboard gate={gate} role={role} />
  ) : (
    <NoDevice gate={gate} role={role} />
  );
}
