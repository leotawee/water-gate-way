import Image from "next/image";
import Link from "next/link";
import { Map, ShieldCheck, type LucideIcon } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

interface AppHeaderProps {
  /** Which top-level section is open; that nav item is marked. Null on a gate's dashboard. */
  active: "map" | "admin" | null;
  /** Shows the Admin link. The admin pages re-check the role themselves. */
  isAdmin: boolean;
}

/** The product mark (public/logo-mark.png). Decorative: the product name always sits next to it as text. */
export function BrandMark({ className = "size-7" }: { className?: string }) {
  return <Image src="/logo-mark.png" alt="" width={128} height={128} className={className} />;
}

/** The mark with the name set beside it (public/logo.png). Put it inside the page's h1; `alt` names the product. */
export function Wordmark({ className = "h-16 w-auto" }: { className?: string }) {
  return <Image src="/logo.png" alt="Water Gate Way" width={480} height={177} priority className={className} />;
}

// WHY: no "use client"; it has no state, only links and a server-action form, so the client dashboard
// can import it too (the server action reference crosses the boundary like any import).
// WHY: the product name is not an h1; each page owns its one h1.
export default function AppHeader({ active, isAdmin }: AppHeaderProps) {
  return (
    <header className="z-[1000] flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
      {/* Visually hidden until focused; the global :focus-visible outline gives it the accent ring. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[1100] focus:inline-flex focus:min-h-11 focus:items-center focus:rounded-md focus:bg-surface focus:px-3 focus:text-sm focus:font-bold focus:text-fg"
      >
        ข้ามไปยังเนื้อหา
      </a>
      <Link href="/" className="flex min-w-0 items-center gap-2 rounded-md">
        <BrandMark />
        {/* On a phone the mark alone carries the brand; the name stays for screen readers. */}
        <span className="sr-only truncate text-base font-bold text-fg sm:not-sr-only">Water Gate Way</span>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <nav aria-label="เมนูหลัก" className="flex items-center gap-1">
          <NavItem href="/" icon={Map} current={active === "map"}>
            แผนที่
          </NavItem>
          {isAdmin && (
            <NavItem href="/admin" icon={ShieldCheck} current={active === "admin"}>
              ผู้ดูแลระบบ
            </NavItem>
          )}
        </nav>

        {/* WHY: the word stays visible at every width; a phone user must find sign-out without guessing.
            Signing out ends the session for the whole device, so it asks once behind a modal (LogoutButton).
            Sign-out wears the danger voice: a destructive affordance should not look like navigation. */}
        <LogoutButton className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold text-danger transition-colors duration-150 hover:bg-danger-soft" />
      </div>
    </header>
  );
}

/** Current section: an accent-tinted pill — selection shares the interaction colour, so the eye
    finds "where am I" with the same colour it finds "what do I press". */
function NavItem({ href, icon: Icon, current, children }: { href: string; icon: LucideIcon; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm transition-colors duration-150 ${
        current ? "bg-tint-blue font-bold text-accent" : "text-muted hover:bg-surface-2 hover:text-fg"
      }`}
    >
      <Icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
      {children}
    </Link>
  );
}
