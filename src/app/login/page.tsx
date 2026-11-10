import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/AppHeader";
import { REMEMBER_COOKIE } from "@/lib/auth/remember";
import { SESSION_COOKIE } from "@/lib/auth/session";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "เข้าสู่ระบบ" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { next, registered, r } = await searchParams;
  // WHY: a remember cookie with r != 0 should be redeemed, not show the form; r=0 marks a failed restore.
  // A live session cookie means the visitor is already in, so nothing is redeemed (no pointless rotation).
  const jar = await cookies();
  if (r !== "0" && jar.has(REMEMBER_COOKIE) && !jar.has(SESSION_COOKIE)) {
    redirect(`/api/auth/restore?next=${encodeURIComponent(typeof next === "string" ? next : "")}`);
  }
  // safeNext() in the action validates this; here it is only passed through.
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-sm">
        <h1>
          <Wordmark />
        </h1>
        <p className="mt-2 text-sm text-muted">ระดับน้ำ ปั๊ม และกล้องของประตูน้ำ</p>
        <div className="mt-6 rounded-lg border border-border bg-surface p-6">
          <h2 className="mb-5 text-base font-bold text-fg">เข้าสู่ระบบ</h2>
          {/* WHY: the same notice for a new account and an existing email, so it reveals nothing. */}
          {registered === "1" && (
            <p role="status" className="anim-rise-in mb-5 rounded-md bg-on-soft px-3 py-2 text-sm text-on">
              ถ้าอีเมลนี้ยังไม่เคยมีบัญชี บัญชีของคุณพร้อมใช้แล้ว เข้าสู่ระบบด้วยรหัสผ่านที่เพิ่งตั้ง
              ถ้ามีบัญชีอยู่แล้ว ใช้รหัสผ่านเดิม
            </p>
          )}
          <LoginForm next={typeof next === "string" ? next : ""} />
        </div>
        <p className="mt-4 text-sm text-muted">
          ยังไม่มีบัญชี{" "}
          <Link href="/register" className="font-bold text-fg underline underline-offset-2 hover:no-underline">
            สมัครใช้งาน
          </Link>
        </p>
      </div>
    </main>
  );
}
