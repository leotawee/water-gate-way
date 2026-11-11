import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/dal";
import AppHeader from "@/components/AppHeader";
import ProfileForm from "./ProfileForm";

export const metadata: Metadata = { title: "โปรไฟล์ของฉัน" };

const THAI_TIME = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "short",
  timeStyle: "short",
  hour12: false,
});

type ActivityRow = { action: string; detail: string; created_at: string };

export default async function ProfilePage() {
  const user = await requirePageUser("/profile");

  const { rows: profileRows } = await db.query(
    `select display_name, phone, line_id, email, role,
            (avatar_webp is not null) as has_avatar,
            (extract(epoch from avatar_updated_at) * 1000)::bigint as avatar_version
     from users where id = $1`,
    [user.id],
  );
  const profile = profileRows[0] as
    | {
        display_name: string | null;
        phone: string | null;
        line_id: string | null;
        email: string;
        role: string;
        has_avatar: boolean;
        avatar_version: string;
      }
    | undefined;

  const { rows: activity } = await db.query(
    "select action, detail, created_at from action_audit where user_id = $1 order by created_at desc limit 10",
    [user.id],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <AppHeader active={null} isAdmin={user.role === "admin"} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-12 sm:px-6">
        <h1 className="text-2xl font-bold text-fg">โปรไฟล์ของฉัน</h1>

        <section aria-labelledby="profile-edit-heading" className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 id="profile-edit-heading" className="sr-only">
            แก้ไขโปรไฟล์
          </h2>
          {profile ? (
            <ProfileForm
              row={{
                email: profile.email,
                role: profile.role,
                display_name: profile.display_name,
                phone: profile.phone,
                line_id: profile.line_id,
                hasAvatar: profile.has_avatar,
                avatarVersion: profile.avatar_version,
              }}
            />
          ) : (
            <p className="text-sm text-danger">โหลดข้อมูลโปรไฟล์ไม่สำเร็จ</p>
          )}
        </section>

        <section aria-labelledby="activity-heading" className="mt-6 rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="activity-heading" className="text-base font-bold text-fg">
              กิจกรรมล่าสุดของคุณ
            </h2>
            {user.role === "admin" && (
              <Link
                href="/admin/logs"
                className="text-sm font-bold text-fg underline underline-offset-2 hover:no-underline"
              >
                ดูทั้งหมด (ผู้ดูแล)
              </Link>
            )}
          </div>
          <ul className="mt-3 space-y-2">
            {activity.length === 0 && <li className="text-sm text-muted">ยังไม่มีกิจกรรมที่บันทึก</li>}
            {activity.map((a: ActivityRow, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1 text-sm">
                <span className="font-bold text-fg">{a.action}</span>
                <span className="text-muted">
                  {a.detail ? `${a.detail} · ` : ""}
                  {THAI_TIME.format(new Date(a.created_at))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
