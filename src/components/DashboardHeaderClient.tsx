"use client";

import Link from "next/link";
import { ArrowLeft, LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";

interface DashboardHeaderClientProps {
  gateName: string;
  /** Shows the Admin link; the admin pages themselves re-check the role. */
  isAdmin: boolean;
}

/** Dashboard app bar: back to the map, the gate name, admin link, sign out. Same bar look as AppHeader. */
export default function DashboardHeaderClient({ gateName, isAdmin }: DashboardHeaderClientProps) {
  return (
    <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          href="/"
          aria-label="กลับไปแผนที่"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-sm font-bold text-fg transition-colors duration-150 hover:bg-surface-2"
        >
          <ArrowLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
          <span className="hidden sm:inline">แผนที่</span>
        </Link>
        <h1 className="truncate text-base font-bold text-fg">{gateName}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {isAdmin && (
          <Link
            href="/admin"
            className="inline-flex h-14 items-center border-b-2 border-transparent px-3 text-sm font-bold text-muted transition-colors duration-150 hover:border-border hover:text-fg"
          >
            ผู้ดูแลระบบ
          </Link>
        )}

        <form action={signOut}>
          <button
            type="submit"
            aria-label="ออกจากระบบ"
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm font-bold text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </form>
      </div>
    </div>
  );
}
