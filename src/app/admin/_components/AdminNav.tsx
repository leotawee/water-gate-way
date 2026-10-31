import Link from "next/link";

export default function AdminNav() {
  const link = "text-sm font-semibold text-blue-700 hover:underline";
  return (
    <nav className="flex flex-wrap items-center gap-4">
      <Link href="/admin" className={link}>
        Admin
      </Link>
      <Link href="/admin/users" className={link}>
        Users
      </Link>
      <Link href="/admin/gates" className={link}>
        Gates
      </Link>
      <Link href="/" className="ml-auto text-sm font-semibold text-gray-700 hover:underline">
        Back to map
      </Link>
    </nav>
  );
}
