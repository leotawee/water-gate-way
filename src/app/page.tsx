import { Suspense } from "react";
import Link from "next/link";
import { MapPin } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import WaterGateMapLoader from "@/components/WaterGateMapLoader";
import { requirePageUser } from "@/lib/auth/dal";
import { listGates } from "@/lib/gatesDb";

function DeviceBadge({ hasDevice }: { hasDevice: boolean }) {
  return hasDevice ? (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-on-soft px-2 py-0.5 text-xs font-bold text-on">
      <span className="size-1.5 rounded-full bg-on" aria-hidden="true" />
      มีอุปกรณ์
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-muted">
      <span className="size-1.5 rounded-full border-2 border-dashed border-unknown" aria-hidden="true" />
      ยังไม่ติดตั้ง
    </span>
  );
}

export default async function HomePage() {
  const user = await requirePageUser("/");
  const gates = await listGates();
  return (
    <main className="flex min-h-dvh w-full flex-col bg-bg lg:h-dvh lg:overflow-hidden">
      <AppHeader active="map" isAdmin={user.role === "admin"} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Mobile: map first (60dvh) then the list, page scrolls; desktop: 320px list left, map fills the rest. */}
        <div className="order-1 h-[60dvh] w-full shrink-0 lg:order-2 lg:h-auto lg:min-h-0 lg:flex-1 lg:shrink">
          <Suspense fallback={null}>
            <WaterGateMapLoader gates={gates} />
          </Suspense>
        </div>

        <aside
          aria-label="รายการประตูน้ำ"
          className="order-2 flex min-h-0 shrink-0 flex-col border-t border-border bg-surface lg:order-1 lg:w-80 lg:border-t-0 lg:border-r"
        >
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-base font-bold text-fg">ประตูน้ำ</h2>
          </header>
          <ul className="divide-y divide-border overflow-y-auto">
            {gates.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/dashboard?gate=${encodeURIComponent(g.id)}`}
                  className="block px-4 py-3 transition-colors duration-150 hover:bg-surface-2"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold text-fg">{g.name}</span>
                    <DeviceBadge hasDevice={g.hasDevice} />
                  </span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                    <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                    <span className="truncate">{g.location || g.id}</span>
                  </span>
                </Link>
              </li>
            ))}
            {gates.length === 0 && <li className="px-4 py-6 text-sm text-muted">ยังไม่มีประตูน้ำในระบบ</li>}
          </ul>
        </aside>
      </div>
    </main>
  );
}
