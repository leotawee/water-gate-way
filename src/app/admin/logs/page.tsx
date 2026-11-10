import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdminPage } from "@/lib/auth/dal";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import AdminShell from "../_components/AdminShell";
import FilterForm, { FilterSelect } from "../_components/FilterForm";
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
      {/* One surface: kind chips and the search/sort controls share the card's toolbar row. */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-rule px-5 py-4">
          <nav aria-label="กรองตามประเภท" className="flex flex-wrap items-center gap-2">
            <Badge asChild variant={kind === "" ? "default" : "outline"} className="h-8 px-3.5">
              <Link href={hrefFor("")}>ทั้งหมด</Link>
            </Badge>
            {KINDS.map((k) => (
              <Badge
                key={k}
                asChild
                variant={kind === k ? "default" : "outline"}
                className="h-8 px-3.5"
              >
                <Link href={hrefFor(k)}>{k}</Link>
              </Badge>
            ))}
          </nav>

          <FilterForm
            ariaLabel="ค้นหาและเรียงบันทึกเหตุการณ์"
            className="flex flex-wrap items-end gap-x-4 gap-y-3"
          >
            {/* WHY hidden kind: a GET form replaces the query string, so the chip selection must travel with the form. */}
            <input type="hidden" name="kind" value={kind} />
            <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-64">
              <span className="text-sm font-bold text-fg">ค้นหาอีเมล</span>
              <Input name="q" type="search" defaultValue={q} placeholder="อีเมล…" className="w-full" />
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-bold text-fg">เรียงตามเวลา</span>
              <FilterSelect
                name="dir"
                value={dir === "asc" ? "asc" : ""}
                ariaLabel="เรียงตามเวลา"
                className="w-40"
                options={[
                  { value: "", label: "ใหม่ → เก่า" },
                  { value: "asc", label: "เก่า → ใหม่" },
                ]}
              />
            </div>
          </FilterForm>
        </div>

        <Table className="min-w-full text-sm">
          <TableHeader className="text-left text-sm text-muted">
            <TableRow className="border-rule hover:bg-transparent">
              <TableHead className="px-5 py-3 font-normal text-muted">เวลา (ไทย)</TableHead>
              <TableHead className="px-5 py-3 font-normal text-muted">ผู้ใช้</TableHead>
              <TableHead className="px-5 py-3 font-normal text-muted">ประเภท</TableHead>
              <TableHead className="px-5 py-3 font-normal text-muted">รายละเอียด</TableHead>
              <TableHead className="px-5 py-3 font-normal text-muted">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((r, i) => (
              <TableRow key={i} className="border-rule align-top">
                <TableCell className="whitespace-nowrap px-5 py-3 text-sm tabular-nums text-fg">{THAI_TIME.format(new Date(r.created_at))}</TableCell>
                <TableCell className="px-5 py-3 text-sm font-bold text-fg">{r.email ?? "—"}</TableCell>
                <TableCell className="px-5 py-3 text-sm">
                  <Badge className={KIND_STYLE[r.kind] ?? "bg-surface-2 text-fg"}>{r.kind}</Badge>
                </TableCell>
                <TableCell className="px-5 py-3 text-sm text-fg">{r.detail}</TableCell>
                <TableCell className="whitespace-nowrap px-5 py-3 text-sm tabular-nums text-muted">{r.ip ?? "—"}</TableCell>
              </TableRow>
            ))}
            {logs.length === 0 && (
              <TableRow className="border-rule hover:bg-transparent">
                <TableCell colSpan={5} className="px-5 py-6 text-center text-sm text-muted">
                  {filtered ? "ไม่มีรายการที่ตรงกับตัวกรอง" : "ยังไม่มีรายการ"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </AdminShell>
  );
}
