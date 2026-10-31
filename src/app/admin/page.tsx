import Link from "next/link";
import { ChevronRight } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { requireAdminPage } from "@/lib/auth/dal";
import AdminNav from "./_components/AdminNav";

const LINK_ROW =
  "flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-150 hover:bg-surface-2/50";

export default async function AdminHomePage() {
  await requireAdminPage("/admin");
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader active="admin" isAdmin />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <AdminNav />
        <h1 className="text-xl font-bold text-fg">ผู้ดูแลระบบ</h1>
        <nav aria-label="หน้าจัดการ">
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            <li>
              <Link href="/admin/users" className={LINK_ROW}>
                <span>
                  <span className="block text-sm font-bold text-fg">ผู้ใช้</span>
                  <span className="mt-0.5 block text-xs text-muted">สร้างบัญชี เปลี่ยนบทบาท ปิดใช้งาน หรือตั้งรหัสผ่านใหม่</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </li>
            <li>
              <Link href="/admin/gates" className={LINK_ROW}>
                <span>
                  <span className="block text-sm font-bold text-fg">ประตูน้ำ</span>
                  <span className="mt-0.5 block text-xs text-muted">เพิ่มหรือแก้ไขประตูน้ำบนแผนที่ เปิดหรือปิดใช้งาน</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </nav>
      </main>
    </div>
  );
}
