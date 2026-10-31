import Link from "next/link";
import { Map as MapIcon, Shield, Waves, LogOut } from "lucide-react";
import { signOut } from "@/app/login/actions";

interface AppHeaderProps {
  /** Which top-level section is open; that nav item is highlighted. */
  active: "map" | "admin";
  /** Shows the Admin link. The admin pages re-check the role themselves. */
  isAdmin: boolean;
}

// WHY: no "use client" needed; this has no state, only links and a server-action form.
export default function AppHeader({ active, isAdmin }: AppHeaderProps) {
  return (
    <header className="z-[1000] flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent/10">
          <Waves className="size-5 text-accent" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1 className="truncate text-base font-bold leading-tight text-fg">Water Gate Way</h1>
      </div>

      <div className="flex shrink-0 items-center">
        <nav aria-label="เมนูหลัก" className="flex items-center">
          <NavItem href="/" current={active === "map"} icon={<MapIcon className="size-4" strokeWidth={1.75} aria-hidden="true" />}>
            แผนที่
          </NavItem>
          {isAdmin && (
            <NavItem href="/admin" current={active === "admin"} icon={<Shield className="size-4" strokeWidth={1.75} aria-hidden="true" />}>
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
            <span className="hidden sm:inline">ออกจากระบบ</span>
          </button>
        </form>
      </div>
    </header>
  );
}

function NavItem({
  href,
  current,
  icon,
  children,
}: {
  href: string;
  current: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`inline-flex h-14 items-center gap-2 border-b-2 px-3 text-sm font-bold transition-colors duration-150 ${
        current ? "border-accent text-accent" : "border-transparent text-muted hover:border-border hover:text-fg"
      }`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
