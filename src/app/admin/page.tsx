import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/dal";
import AdminNav from "./_components/AdminNav";

export default async function AdminHomePage() {
  await requireAdminPage("/admin");
  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <AdminNav />
        <h1 className="text-2xl font-bold text-gray-900">Admin</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/admin/users" className="rounded-xl bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="font-semibold text-gray-900">Users</h2>
            <p className="text-sm text-gray-600 mt-1">Create accounts, change roles, disable or reset passwords.</p>
          </Link>
          <Link href="/admin/gates" className="rounded-xl bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
            <h2 className="font-semibold text-gray-900">Gates</h2>
            <p className="text-sm text-gray-600 mt-1">Add or edit gates on the map, activate or deactivate them.</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
