import Link from "next/link";
import { Suspense } from "react";
import WaterGateMapLoader from "@/components/WaterGateMapLoader";
import { requirePageUser } from "@/lib/auth/dal";
import { listGates } from "@/lib/gatesDb";

export default async function HomePage() {
  const user = await requirePageUser("/");
  const gates = await listGates();
  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden">
      <header className="bg-blue-600 text-white px-6 py-4 shadow-md z-[1000] shrink-0 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold">Water Gate Controller Map</h1>
          <p className="text-sm text-blue-100">
            Select a water gate location in Chiang Mai to view its dashboard
          </p>
        </div>
        {user.role === "admin" && (
          <Link
            href="/admin"
            className="shrink-0 rounded-lg bg-white/90 hover:bg-white px-3 py-1.5 text-sm font-bold text-blue-700 shadow-sm"
          >
            Admin
          </Link>
        )}
      </header>
      <div className="flex-1 relative">
        <Suspense fallback={null}>
          <WaterGateMapLoader gates={gates} />
        </Suspense>
      </div>
    </main>
  );
}
