import { MapPin } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/dal";
import { listGates } from "@/lib/gatesDb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import AdminShell from "../_components/AdminShell";
import CreateGateDialog from "../_components/CreateGateDialog";
import FilterForm, { FilterSelect } from "../_components/FilterForm";
import GateConfigDialog from "../_components/GateConfigDialog";
import { firstParam } from "../_components/shared";

const FIELD_LABEL = "text-sm font-normal text-muted";

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> };

export default async function AdminGatesPage({ searchParams }: Props) {
  await requireAdminPage("/admin/gates");
  const sp = await searchParams;
  const q = firstParam(sp.q).trim().slice(0, 100);
  const statusParam = firstParam(sp.status);
  const status = statusParam === "shown" || statusParam === "hidden" ? statusParam : "";
  const sort = firstParam(sp.sort) === "id" ? "id" : "name";
  const filtered = Boolean(q || status);

  const gates = await listGates({ includeInactive: true });
  const hidden = gates.filter((g) => !g.active).length;

  // WHY in memory: gates are a hand-sized list; filters here read clearer than SQL plumbing.
  let list = gates;
  if (q) {
    const needle = q.toLowerCase();
    list = list.filter((g) => [g.name, g.id, g.location].some((v) => (v ?? "").toLowerCase().includes(needle)));
  }
  if (status === "shown") list = list.filter((g) => g.active);
  if (status === "hidden") list = list.filter((g) => !g.active);
  list = [...list].sort((a, b) =>
    sort === "id" ? a.id.localeCompare(b.id) : (a.name || a.id).localeCompare(b.name || b.id, "th"),
  );

  return (
    <AdminShell
      icon={MapPin}
      title="ประตูน้ำ"
      subtitle={`${filtered ? `${list.length} จาก ${gates.length} แห่ง` : `${gates.length} แห่ง`} · ซ่อนอยู่ ${hidden}`}
      action={<CreateGateDialog />}
    >
      {/* One surface: the filter toolbar sits inside the list card, like the users page. */}
      <div className="rounded-lg border border-border bg-surface">
        <div className="border-b border-rule px-5 py-4">
          <FilterForm ariaLabel="กรองประตูน้ำ" className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="grid min-w-0 flex-1 gap-1.5 sm:max-w-64">
              <span className={FIELD_LABEL}>ค้นหา</span>
              <Input name="q" type="search" defaultValue={q} placeholder="ชื่อ รหัส หรือที่ตั้ง…" className="w-full" />
            </div>
            <div className="grid gap-1.5">
              <span className={FIELD_LABEL}>สถานะ</span>
              <FilterSelect
                name="status"
                value={status}
                ariaLabel="กรองตามสถานะ"
                className="w-40"
                options={[
                  { value: "", label: "ทั้งหมด" },
                  { value: "shown", label: "แสดงบนแผนที่" },
                  { value: "hidden", label: "ซ่อนอยู่" },
                ]}
              />
            </div>
            <div className="grid gap-1.5">
              <span className={FIELD_LABEL}>เรียงตาม</span>
              <FilterSelect
                name="sort"
                value={sort}
                ariaLabel="เรียงลำดับ"
                className="w-40"
                options={[
                  { value: "name", label: "ชื่อ" },
                  { value: "id", label: "รหัส" },
                ]}
              />
            </div>
          </FilterForm>
        </div>

        {/* WHY: each row is one quiet line — name, where, device state — and every configuration
            (record edit, map visibility) lives in the row's dialog, not in the list itself. */}
        <ul className="divide-y divide-rule">
          {list.map((g) => (
            <li key={g.id} className="flex items-center gap-4 px-5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold text-fg">{g.name || g.id}</span>
                <span className="mt-0.5 block truncate text-sm text-muted">
                  {g.id} · {g.location || "ไม่ระบุที่ตั้ง"}
                </span>
              </span>
              <span className="hidden text-sm text-muted tabular-nums md:block">
                {g.lat.toFixed(4)}, {g.lng.toFixed(4)}
              </span>
              <span className="hidden sm:block">
                {g.hasDevice ? <Badge className="bg-on-soft text-on">มีอุปกรณ์</Badge> : <Badge variant="outline">ยังไม่ติดตั้ง</Badge>}
              </span>
              {/* WHY: only the exception gets a mark; a visible gate is the normal case. */}
              {!g.active && <Badge variant="outline" className="border-dashed text-muted">ซ่อนอยู่</Badge>}
              <GateConfigDialog gate={g} />
            </li>
          ))}
          {list.length === 0 && (
            <li className="px-5 py-4 text-sm text-muted">
              {filtered ? "ไม่มีประตูน้ำที่ตรงกับตัวกรอง" : "ยังไม่มีประตูน้ำ กดปุ่มรูปเพิ่มด้านบนขวาเพื่อเริ่ม"}
            </li>
          )}
        </ul>
      </div>
    </AdminShell>
  );
}
