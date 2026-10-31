import { Suspense } from "react";
import AppHeader from "@/components/AppHeader";
import WaterGateMapLoader from "@/components/WaterGateMapLoader";
import { requirePageUser } from "@/lib/auth/dal";
import { listGates } from "@/lib/gatesDb";

export default async function HomePage() {
  const user = await requirePageUser("/");
  const gates = await listGates();
  return (
    <main className="flex h-dvh w-full flex-col overflow-hidden bg-bg">
      <AppHeader
        active="map"
        isAdmin={user.role === "admin"}
        subtitle="Select a water gate location in Chiang Mai to view its dashboard"
      />
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={null}>
          <WaterGateMapLoader gates={gates} />
        </Suspense>
      </div>
    </main>
  );
}
