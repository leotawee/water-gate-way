"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Droplets, Activity, ArrowLeft, LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";

interface DashboardHeaderClientProps {
  clock: string;
}

export default function DashboardHeaderClient({
  clock,
}: DashboardHeaderClientProps) {
  const searchParams = useSearchParams();
  const locationName = searchParams?.get("location") ?? "Unknown Gate";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
      {/* Left: Back button + Icon + Title */}
      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/"
          className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-yellow-500 hover:bg-yellow-600 text-gray-900 transition-colors text-xs sm:text-sm font-bold shadow-sm"
          title="Back to Map"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Map</span>
        </Link>

        <Droplets className="w-7 h-7 sm:w-8 sm:h-8 text-blue-700 shrink-0" />

        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 tracking-tight leading-tight">
            {locationName}
          </h1>
          <p className="text-xs sm:text-sm text-gray-700 font-medium">
            Irrigation Department — Real-time Monitoring
          </p>
        </div>
      </div>

      {/* Right: Badge + Online + Clock */}
      <div className="flex items-center gap-2 sm:gap-4 text-gray-800">
        <span
          className="text-xs sm:text-sm font-bold bg-white/80 rounded-lg px-2 sm:px-3 py-1 sm:py-1.5 text-gray-900 truncate max-w-[120px] sm:max-w-none"
          title={locationName}
        >
          📍 {locationName}
        </span>

        <div className="hidden sm:flex items-center gap-1.5 bg-yellow-300/60 rounded-lg px-3 py-1.5">
          <Activity className="w-4 h-4 text-green-700" />
          <span className="text-xs font-semibold text-green-800">ONLINE</span>
        </div>

        <span className="hidden sm:flex text-sm font-mono font-semibold bg-yellow-300/60 rounded-lg px-3 py-1.5">
          {clock}
        </span>

        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 rounded-lg bg-white/80 hover:bg-white text-gray-900 text-xs sm:text-sm font-bold shadow-sm transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </div>
  );
}
