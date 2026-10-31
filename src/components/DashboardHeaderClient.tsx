"use client";

import Link from "next/link";
import { Waves, ArrowLeft, LogOut, MapPin, Shield, Wifi, WifiOff } from "lucide-react";
import { signOut } from "@/app/login/actions";

interface DashboardHeaderClientProps {
  gateName: string;
  clock: string;
  /** Telemetry stale or disconnected: badge shows OFFLINE. */
  stale: boolean;
  /** Shows the Admin link; the admin pages themselves re-check the role. */
  isAdmin: boolean;
}

export default function DashboardHeaderClient({
  gateName: locationName,
  clock,
  stale,
  isAdmin,
}: DashboardHeaderClientProps) {
  return (
    <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      {/* Left: Back button + app mark + title. Same height as AppHeader. */}
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/"
          aria-label="Back to map"
          title="Back to Map"
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 text-sm font-medium text-fg transition-colors duration-200 hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Map</span>
        </Link>

        <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-inset ring-accent/30 sm:flex">
          <Waves className="size-5 text-accent" aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight text-fg sm:text-lg">{locationName}</h1>
          <p className="hidden truncate text-xs text-muted sm:block">Irrigation Department — Real-time Monitoring</p>
        </div>
      </div>

      {/* Right: Admin + location + online state + clock + sign out */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {isAdmin && (
          <Link
            href="/admin"
            title="Admin"
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Shield className="size-4" aria-hidden="true" />
            <span>Admin</span>
          </Link>
        )}

        <span
          className="hidden max-w-[160px] items-center gap-1.5 truncate rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-sm text-fg md:inline-flex"
          title={locationName}
        >
          <MapPin className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="truncate">{locationName}</span>
        </span>

        <span
          className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset sm:inline-flex ${
            stale ? "bg-danger/10 text-danger ring-danger/40" : "bg-ok/10 text-ok ring-ok/40"
          }`}
        >
          {stale ? <WifiOff className="size-3.5" aria-hidden="true" /> : <Wifi className="size-3.5" aria-hidden="true" />}
          {stale ? "OFFLINE" : "ONLINE"}
        </span>

        <span className="hidden font-mono text-sm font-medium tabular-nums text-muted sm:inline">{clock}</span>

        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <LogOut className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </div>
  );
}
