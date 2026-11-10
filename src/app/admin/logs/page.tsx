import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/dal";
import { ScrollText } from "lucide-react";
import AdminShell from "../_components/AdminShell";

export const metadata: Metadata = { title: "บันทึกเหตุการณ์" };

const THAI_TIME = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "short",
  timeStyle: "medium",
  hour12: false,
});

type LogRow = { created_at: string; email: string | null; kind: string; detail: string; ip: string | null };

/** The three audit feeds, newest first: control commands, admin operations, account actions. */
const QUERY = `select created_at, email, kind, detail, ip from (
  select ca.created_at, u.email::text as email, 'คำสั่งอุปกรณ์' as kind,
         ca.command || ' · ' || ca.status as detail, ca.ip::text as ip
  from control_audit ca left join users u on u.id = ca.user_id
  union all
  select aa.created_at, u.email::text,
         case when aa.action = 'user.register' then 'บัญชี' else 'ฝั่งผู้ดูแล' end,
         aa.action || ' ' || aa.target, aa.ip::text
  from admin_audit aa left join users u on u.id = aa.actor_id
  union all
  select a.created_at, u.email::text, 'บัญชี',
         a.action || case when a.detail = '' then '' else ' · ' || a.detail end, a.ip::text
  from action_audit a left join users u on u.id = a.user_id
) t order by created_at desc limit 100`;

const KIND_STYLE: Record<string, string> = {
  คำสั่งอุปกรณ์: "bg-tint-blue text-accent",
  ฝั่งผู้ดูแล: "bg-warn-soft text-warn",
  บัญชี: "bg-surface-2 text-fg",
};

export default async function AdminLogsPage() {
  await requireAdminPage("/admin/logs");
  const { rows } = await db.query(QUERY);
  const logs = rows as LogRow[];

  return (
    <AdminShell icon={ScrollText} title="บันทึกเหตุการณ์" subtitle={`100 รายการล่าสุด จากทั้งสามระบบ (คำสั่ง · ฝั่งผู้ดูแล · บัญชี)`}>
      <div className="rounded-lg border border-border bg-surface">
        {/* WHY: the table scrolls inside its own frame on a phone; the page never scrolls sideways. */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead className="text-left text-sm text-muted">
              <tr>
                <th className="px-5 py-3 font-normal">เวลา (ไทย)</th>
                <th className="px-5 py-3 font-normal">ผู้ใช้</th>
                <th className="px-5 py-3 font-normal">ประเภท</th>
                <th className="px-5 py-3 font-normal">รายละเอียด</th>
                <th className="px-5 py-3 font-normal">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((r, i) => (
                <tr key={i} className="border-t border-rule align-top">
                  <td className="whitespace-nowrap px-5 py-3 text-sm tabular-nums text-fg">{THAI_TIME.format(new Date(r.created_at))}</td>
                  <td className="px-5 py-3 text-sm font-bold text-fg">{r.email ?? "—"}</td>
                  <td className="px-5 py-3 text-sm">
                    <span className={`pill ${KIND_STYLE[r.kind] ?? "bg-surface-2 text-fg"}`}>{r.kind}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-fg">{r.detail}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-sm tabular-nums text-muted">{r.ip ?? "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-sm text-muted">
                    ยังไม่มีรายการ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}
