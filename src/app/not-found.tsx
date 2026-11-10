import Link from "next/link";
import { Button } from "@/components/ui/button";

// WHY: generic on purpose — requireAdminPage() 404s non-admins here, so nothing may hint at /admin.
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
        <h1 className="text-xl font-bold text-fg">ไม่พบหน้านี้</h1>
        <p className="mt-2 text-sm text-muted">ไม่พบหน้าหรือที่อยู่ที่เรียก อาจถูกย้ายหรือลบไปแล้ว</p>
        <div className="mt-5">
          <Button variant="outline" asChild>
            <Link href="/">กลับหน้าแรก</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
