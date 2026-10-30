import { Suspense } from "react";
import WaterGateMapLoader from "@/components/WaterGateMapLoader";
import { requirePageUser } from "@/lib/auth/dal";

export default async function HomePage() {
  await requirePageUser("/");
  return (
    <main className="h-screen w-screen flex flex-col overflow-hidden">
      <header className="bg-blue-600 text-white px-6 py-4 shadow-md z-[1000] shrink-0">
        <h1 className="text-xl font-bold">Water Gate Controller Map</h1>
        <p className="text-sm text-blue-100">
          Select a water gate location in Chiang Mai to view its dashboard
        </p>
      </header>
      <div className="flex-1 relative">
        <Suspense fallback={null}>
          <WaterGateMapLoader />
        </Suspense>
      </div>
    </main>
  );
}
