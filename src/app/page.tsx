import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, List, MapPin } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import WaterGateMapLoader from "@/components/WaterGateMapLoader";
import StatePill from "@/components/StatePill";
import { requirePageUser } from "@/lib/auth/dal";
import { listGates } from "@/lib/gatesDb";

export default async function HomePage() {
  const user = await requirePageUser("/");
  const gates = await listGates();
  const withDevice = gates.filter((g) => g.hasDevice).length;
  return (
    <main id="main" className="flex min-h-dvh w-full flex-col bg-bg lg:h-dvh lg:overflow-hidden">
      <AppHeader active="map" isAdmin={user.role === "admin"} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Mobile: map first (50dvh, so the list below is reachable) then the list, page scrolls;
            desktop: 360px list left, map fills the rest. */}
        <div className="relative order-1 h-[50dvh] w-full shrink-0 lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink">
          <Suspense fallback={null}>
            <WaterGateMapLoader gates={gates} />
          </Suspense>
          {/* WHY: z-[1000] sits above Leaflet's panes and controls. */}
          <a
            href="#gate-list"
            className="absolute right-3 bottom-3 z-[1000] inline-flex min-h-11 items-center gap-2 rounded-md border border-control bg-surface px-3 text-sm font-bold text-fg transition-colors duration-150 hover:bg-surface-2 lg:hidden"
          >
            <List className="size-4" strokeWidth={1.75} aria-hidden="true" />
            ดูรายการประตูน้ำ
          </a>
        </div>

        <aside
          id="gate-list"
          aria-labelledby="gate-list-heading"
          className="order-2 flex min-h-0 shrink-0 scroll-mt-12 flex-col border-t border-border bg-surface lg:order-1 lg:w-[360px] lg:border-t-0 lg:border-r"
        >
          <header className="px-5 pt-5 pb-3">
            <h1 id="gate-list-heading" className="flex items-center gap-2.5 text-2xl font-bold text-fg">
              <MapPin className="size-6 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
              ประตูน้ำ
            </h1>
            <p className="mt-1 text-sm text-muted tabular-nums">
              {gates.length} แห่ง · มีอุปกรณ์ {withDevice} แห่ง
            </p>
          </header>
          <ul className="overflow-y-auto px-2 pb-3">
            {gates.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/dashboard?gate=${encodeURIComponent(g.id)}`}
                  className="group flex items-center gap-3 rounded-md px-3 py-3 transition-colors duration-150 hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-fg">{g.name}</span>
                    <span className="mt-0.5 block truncate text-sm text-muted">{g.location || g.id}</span>
                  </span>
                  {g.hasDevice ? (
                    <StatePill tone="on">มีอุปกรณ์</StatePill>
                  ) : (
                    <StatePill tone="off">ยังไม่ติดตั้ง</StatePill>
                  )}
                  <ChevronRight
                    className="size-4 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
            {gates.length === 0 && (
              <li className="mx-3 rounded-md border border-dashed border-border px-4 py-4 text-sm text-muted">
                ยังไม่มีประตูน้ำในระบบ ผู้ดูแลระบบเพิ่มได้ที่หน้าจัดการประตูน้ำ
              </li>
            )}
          </ul>
        </aside>
      </div>
    </main>
  );
}
