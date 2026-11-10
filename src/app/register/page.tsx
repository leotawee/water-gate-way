import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Wordmark } from "@/components/AppHeader";
import { getUser } from "@/lib/auth/dal";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "สมัครใช้งาน" };
// WHY: force-dynamic because the page reads cookies (signed-in users are redirected home).
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // WHY: a signed-in user has nothing to sign up for.
  if (await getUser()) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <Wordmark />
        <p className="mt-2 text-sm text-muted">ระดับน้ำ ปั๊ม และกล้องของประตูน้ำ</p>
        <div className="mt-6 rounded-lg border border-border bg-surface p-6">
          <h1 className="mb-1 text-base font-bold text-fg">สมัครใช้งาน</h1>
          <p className="mb-5 text-sm text-muted">บัญชีใหม่ดูข้อมูลได้อย่างเดียว ผู้ดูแลระบบเปลี่ยนสิทธิ์ให้ควบคุมอุปกรณ์ได้</p>
          <RegisterForm />
        </div>
        <p className="mt-4 text-sm text-muted">
          มีบัญชีแล้ว{" "}
          <Link href="/login" className="font-bold text-fg underline underline-offset-2 hover:no-underline">
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  );
}
