import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import AdminNav from "./AdminNav";

/** Frame shared by every admin view: app bar, section tabs, then the view's one h1 and its scope line.
 *  `action` (optional) sits at the right of the h1 row — e.g. the create-user icon on the users page. */
export default function AdminShell({
  title,
  icon: Icon,
  subtitle,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AppHeader active="admin" isAdmin />
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-12 sm:px-6">
        <AdminNav />
        <div className="mt-6 mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-2xl font-bold text-fg">
              <Icon className="size-6 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
              {title}
            </h1>
            {subtitle && <p className="mt-1 text-sm text-muted tabular-nums">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
