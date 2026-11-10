import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/dal";
import { ScrollText, Search } from "lucide-react";
import AdminShell from "../_components/AdminShell";
import FilterForm from "../_components/FilterForm";
import { firstParam } from "../_components/shared";

export const metadata: Metadata = { title: "บันทึกเหตุการณ์" };

const THAI_TIME = new Intl.DateTimeFormat("th-TH", {
  timeZone: "Asia/Bangkok",
  dateStyle: "short",
  timeStyle: "medium",
  hour12: false,
});

type LogRow = { created_at: string; email: string | null; kind: string; detail: string; ip: string | null };

/** The three audit feeds: control commands, admin operations, account actions. */
const FEEDS = `select created_at, email, kind, detail, ip from (
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
) t`;

const KIND_STYLE: Record<string, string> = {
  คำสั่งอุปกรณ์: "bg-tint-blue text-accent",
  ฝั่งผู้ดูแล: "bg-warn-soft text-warn",
  บัญชี: "bg-surface-2 text-fg",
};

const KINDS = ["คำสั่งอุปกรณ์", "ฝั่งผู้ดูแล", "บัญชี"] as const;

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

const chip = "inline-flex items-center rounded-full px-3.5 py-1.5 text-sm font-bold transition-colors duration-150";
const chipIdle = `${chip} cursor-pointer bg-surface-2 text-muted hover:bg-surface-2/70`;

export default async function AdminLogsPage({ searchParams }: Props) {
  await requireAdminPage("/admin/logs");
  const sp = await searchParams;
  const q = firstParam(sp.q).trim().slice(0, 100);
  const kindParam = firstParam(sp.kind);
  const kind = (KINDS as readonly string[]).includes(kindParam) ? kindParam : "";
  const dir = firstParam(sp.dir) === "asc" ? "asc" : "desc";
  const filtered = Boolean(q || kind);

  // WHY bound $1/$2 and a whitelisted direction string: user input never becomes SQL text,
  // and the limit lands after the filter, so "100 ล่าสุด" always means "100 ล่าสุดที่ตรงตัวกรอง".
  const query = `${FEEDS} where ($1::text is null or t.kind = $1) and ($2::text is null or t.email ilike '%' || $2 || '%') order by t.created_at ${dir} limit 100`;
  const { rows } = await db.query(query, [kind || null, q || null]);
  const logs = rows as LogRow[];

  // Chips keep the other filters so switching kind does not erase a search.
  const hrefFor = (k: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (dir === "asc") p.set("dir", dir);
    if (k) p.set("kind", k);
    const s = p.toString();
    return s ? `/admin/logs?${s}` : "/admin/logs";
  };

  return (
    <AdminShell
      icon={ScrollText}
      title="บันทึกเหตุการณ์"
      subtitle={
        filtered
          ? `${logs.length} รายการล่าสุดที่ตรงตัวกรอง${kind ? ` · ${kind}` : ""}${q ? ` · "${q}"` : ""}`
          : `100 รายการล่าสุด จากทั้งสามระบบ (คำสั่ง · ฝั่งผู้ดูแล · บัญชี)`
      }
    >
      <nav aria-label="กรองตามประเภท" className="mb-3 flex flex-wrap items-center gap-2">
        <Link href={hrefFor("")} className={kind === "" ? `${chip} bg-accent text-white` : chipIdle}>
          ทั้งหมด
        </Link>
        {KINDS.map((k) => (
          <Link
            key={k}
            href={hrefFor(k)}
            className={kind === k ? `${chip} ${KIND_STYLE[k]} ring-1 ring-accent` : chipIdle}
          >
            {k}
          </Link>
        ))}
      </nav>

      <FilterForm
        ariaLabel="ค้นหาและเรียงบันทึกเหตุการณ์"
        className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-border bg-surface px-5 py-4"
      >
        {/* WHY hidden kind: a GET form replaces the query string, so the chip selection must travel with the form. */}
        <input type="hidden" name="kind" value={kind} />
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-bold text-fg sm:max-w-64">
          ค้นหาอีเมล
          <input name="q" type="search" defaultValue={q} placeholder="อีเมล…" className="input-field w-full" />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold text-fg">
          เรียงตามเวลา
          <select name="dir" defaultValue={dir} className="input-field w-40">
            <option value="desc">ใหม่ → เก่า</option>
            <option value="asc">เก่า → ใหม่</option>
          </select>
        </label>
        <button type="submit" className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap">
          <Search className="size-4" strokeWidth={1.75} aria-hidden="true" />
          กรอง
        </button>
      </FilterForm>

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
                    {filtered ? "ไม่มีรายการที่ตรงกับตัวกรอง" : "ยังไม่มีรายการ"}
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
