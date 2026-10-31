"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/gates", label: "Gates" },
] as const;

/** Admin sub-navigation as tabs. "/admin" matches only exactly; the other tabs match their prefix. */
export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="overflow-x-auto border-b border-border">
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const current = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`-mb-px inline-flex min-h-11 cursor-pointer items-center border-b-2 px-4 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  current ? "border-accent text-accent" : "border-transparent text-muted hover:border-border hover:text-fg"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
