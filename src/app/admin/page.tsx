import Link from "next/link";
import { ChevronRight, LayoutDashboard, MapPin, Users, type LucideIcon } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { listGates } from "@/lib/gatesDb";
import AdminShell from "./_components/AdminShell";

const ROLE_THAI: Record<string, string> = { admin: "ผู้ดูแลระบบ", operator: "ผู้ควบคุม", viewer: "ผู้ชม" };

/** One figure with its label; the figure leads. */
function Figure({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-fg tabular-nums">{value}</dd>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  href,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  href: string;
  action: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-fg">
          <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
          {title}
        </h2>
        <Link
          href={href}
          className="group inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-bold text-fg transition-colors duration-150 hover:bg-surface-2"
        >
          {action}
          <ChevronRight
            className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        </Link>
      </header>
      {children}
    </section>
  );
}

export default async function AdminHomePage() {
  await requireAdminPage("/admin");
  // WHY: counts only; no row from users ever reaches this page.
  const { rows } = await db.query("select role, disabled, count(*)::int as n from users group by role, disabled");
  const counts = rows as { role: string; disabled: boolean; n: number }[];
  const activeByRole = (role: string) => counts.filter((c) => c.role === role && !c.disabled).reduce((a, c) => a + c.n, 0);
  const disabled = counts.filter((c) => c.disabled).reduce((a, c) => a + c.n, 0);
  const totalUsers = counts.reduce((a, c) => a + c.n, 0);

  const gates = await listGates({ includeInactive: true });
  const shown = gates.filter((g) => g.active).length;

  return (
    <AdminShell icon={LayoutDashboard} title="ผู้ดูแลระบบ" subtitle={`ผู้ใช้ ${totalUsers} บัญชี · ประตูน้ำ ${gates.length} แห่ง`}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="ผู้ใช้" icon={Users} href="/admin/users" action="จัดการผู้ใช้">
          <dl className="grid grid-cols-2 divide-rule sm:grid-cols-4 sm:divide-x">
            {(["admin", "operator", "viewer"] as const).map((r) => (
              <Figure key={r} label={ROLE_THAI[r]} value={activeByRole(r)} />
            ))}
            <Figure label="ปิดใช้งาน" value={disabled} />
          </dl>
        </Panel>

        <Panel title="ประตูน้ำ" icon={MapPin} href="/admin/gates" action="จัดการประตูน้ำ">
          <dl className="grid grid-cols-2 divide-rule sm:grid-cols-4 sm:divide-x">
            <Figure label="แสดงบนแผนที่" value={shown} />
            <Figure label="ซ่อนอยู่" value={gates.length - shown} />
            <Figure label="มีอุปกรณ์" value={gates.filter((g) => g.hasDevice).length} />
            <Figure label="ยังไม่ติดตั้ง" value={gates.filter((g) => !g.hasDevice).length} />
          </dl>
        </Panel>
      </div>
    </AdminShell>
  );
}
