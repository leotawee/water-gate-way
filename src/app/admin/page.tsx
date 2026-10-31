import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { requireAdminPage } from "@/lib/auth/dal";
import AdminNav from "./_components/AdminNav";

const LINK_CARD =
  "card flex cursor-pointer items-start gap-4 transition-colors duration-200 hover:border-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export default async function AdminHomePage() {
  await requireAdminPage("/admin");
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader active="admin" isAdmin />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <AdminNav />
        <h1 className="text-xl font-semibold text-fg">Admin</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/admin/users" className={LINK_CARD}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-inset ring-accent/30">
              <Users className="size-5 text-accent" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold text-fg">Users</span>
              <span className="mt-1 block text-sm text-muted">Create accounts, change roles, disable or reset passwords.</span>
            </span>
          </Link>
          <Link href="/admin/gates" className={LINK_CARD}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 ring-1 ring-inset ring-accent/30">
              <MapPin className="size-5 text-accent" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold text-fg">Gates</span>
              <span className="mt-1 block text-sm text-muted">Add or edit gates on the map, activate or deactivate them.</span>
            </span>
          </Link>
        </div>
      </main>
    </div>
  );
}
