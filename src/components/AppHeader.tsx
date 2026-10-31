import Link from "next/link";
import type { ReactNode } from "react";
import { Map as MapIcon, Shield, Waves } from "lucide-react";

interface AppHeaderProps {
  /** Shown under the title on md+ screens. */
  subtitle?: string;
  /** Which top-level section is open; that nav item is highlighted. */
  active: "map" | "admin";
  /** Shows the Admin link. The admin pages re-check the role themselves. */
  isAdmin: boolean;
  /** Extra right-side items, after the nav links. */
  children?: ReactNode;
}

// WHY: no "use client" needed; this has no state, only links.
export default function AppHeader({ subtitle, active, isAdmin, children }: AppHeaderProps) {
  return (
    <header className="z-[1000] flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-inset ring-accent/30">
          <Waves className="size-5 text-accent" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold leading-tight text-fg">Water Gate Way</h1>
          {subtitle && <p className="hidden truncate text-xs text-muted md:block">{subtitle}</p>}
        </div>
      </div>

      <nav aria-label="Main" className="flex shrink-0 items-center gap-1">
        <NavItem href="/" current={active === "map"} icon={<MapIcon className="size-4" aria-hidden="true" />}>
          Map
        </NavItem>
        {isAdmin && (
          <NavItem href="/admin" current={active === "admin"} icon={<Shield className="size-4" aria-hidden="true" />}>
            Admin
          </NavItem>
        )}
        {children}
      </nav>
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
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        current ? "bg-accent/15 text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      {icon}
      <span>{children}</span>
    </Link>
  );
}
