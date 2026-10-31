"use client";

import Link from "next/link";
import { LogOut, Map as MapIcon, Shield } from "lucide-react";
import { signOut } from "@/app/login/actions";

interface DashboardHeaderClientProps {
  gateName: string;
  /** Shows the Admin link; the admin pages themselves re-check the role. */
  isAdmin: boolean;
}

/* Same nav item look as AppHeader: h-14 with the underline that marks the current section.
   On a gate's dashboard neither section is current, so both items sit neutral until hover. */
function NavItem({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-14 items-center gap-2 border-b-2 border-transparent px-2.5 text-sm font-bold text-muted transition-colors duration-150 hover:border-border hover:text-fg sm:px-3"
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}

/** Dashboard app bar: the gate name, the same map/admin nav as AppHeader, sign out. */
export default function DashboardHeaderClient({ gateName, isAdmin }: DashboardHeaderClientProps) {
  return (
    <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
      <h1 className="min-w-0 truncate text-base font-bold text-fg">{gateName}</h1>

      <div className="flex shrink-0 items-center">
        <nav aria-label="เมนูหลัก" className="flex items-center">
          <NavItem href="/" icon={<MapIcon className="size-4" strokeWidth={1.75} aria-hidden="true" />}>
            แผนที่
          </NavItem>
          {isAdmin && (
            <NavItem href="/admin" icon={<Shield className="size-4" strokeWidth={1.75} aria-hidden="true" />}>
              ผู้ดูแลระบบ
            </NavItem>
          )}
        </nav>

        <form action={signOut} className="ml-2">
          <button
            type="submit"
            aria-label="ออกจากระบบ"
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-2.5 text-sm font-bold text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-fg"
          >
            <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
            {/* WHY: visible at every width — a phone user must find sign-out without guessing. */}
            <span>ออกจากระบบ</span>
          </button>
        </form>
      </div>
    </div>
  );
}
