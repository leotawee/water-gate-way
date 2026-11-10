"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MapPin, ScrollText, Users } from "lucide-react";

const TABS = [
  { href: "/admin", label: "ภาพรวม", icon: LayoutDashboard },
  { href: "/admin/users", label: "ผู้ใช้", icon: Users },
  { href: "/admin/gates", label: "ประตูน้ำ", icon: MapPin },
  { href: "/admin/logs", label: "บันทึกเหตุการณ์", icon: ScrollText },
] as const;

/** Admin sub-navigation as tabs. "/admin" matches only exactly; the other tabs match their prefix. */
export default function AdminNav() {
  const pathname = usePathname();
  return (
    // WHY: overflow-x-auto alone makes overflow-y auto too (CSS rule); the old -mb-px underline and the
    // inline line box overflowed by a few px and showed a vertical scrollbar. Clip y; tabs still scroll sideways.
    <nav aria-label="ส่วนของผู้ดูแลระบบ" className="overflow-x-auto overflow-y-hidden border-b border-border">
      <ul className="flex min-w-max gap-1">
        {TABS.map((tab) => {
          const current = tab.href === "/admin" ? pathname === "/admin" : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`flex min-h-11 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm font-bold transition-colors duration-150 ${
                  current ? "border-fg text-fg" : "border-transparent text-muted hover:border-control hover:text-fg"
                }`}
              >
                <tab.icon className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
