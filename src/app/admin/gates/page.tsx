import { ChevronDown, MapPin } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/dal";
import { listGates } from "@/lib/gatesDb";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ActionForm from "../_components/ActionForm";
import AdminShell from "../_components/AdminShell";
import CreateGateDialog from "../_components/CreateGateDialog";
import FilterForm, { FilterSelect } from "../_components/FilterForm";
import GateFields from "../_components/GateFields";
import { firstParam } from "../_components/shared";
import { setGateActive, updateGate } from "../actions";

const SUMMARY =
  "flex cursor-pointer list-none items-center gap-4 rounded-lg px-5 py-3 transition-colors duration-150 hover:bg-surface-2 [&::-webkit-details-marker]:hidden";

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
              <span className="text-sm font-bold text-fg">ค้นหา</span>
              <Input name="q" type="search" defaultValue={q} placeholder="ชื่อ รหัส หรือที่ตั้ง…" className="w-full" />
            </div>
            <div className="grid gap-1.5">
              <span className="text-sm font-bold text-fg">สถานะ</span>
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
              <span className="text-sm font-bold text-fg">เรียงตาม</span>
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

        {/* WHY: each gate folds to one row; its edit form opens in place, so the list fits a screen. */}
        <ul className="divide-y divide-rule">
          {list.map((g) => (
            <li key={g.id}>
              <details className="group">
                <summary className={SUMMARY}>
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
                  <ChevronDown
                    className="size-4 shrink-0 text-muted transition-transform duration-150 group-open:rotate-180"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                  <span className="sr-only">แก้ไข {g.name || g.id}</span>
                </summary>

                <div className="border-t border-rule px-5 pt-4 pb-5">
                  <ActionForm action={updateGate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <input type="hidden" name="id" value={g.id} />
                    <GateFields name={g.name} location={g.location} lat={g.lat} lng={g.lng} hasDevice={g.hasDevice} />
                    <Button type="submit" variant="outline" className="justify-self-start whitespace-nowrap">
                      บันทึกการแก้ไข
                    </Button>
                  </ActionForm>
                  <ActionForm
                    action={setGateActive}
                    className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-bg px-4 py-3"
                    confirm={
                      g.active
                        ? `ซ่อน “${g.name || g.id}” จากแผนที่และแดชบอร์ด?`
                        : `แสดง “${g.name || g.id}” บนแผนที่อีกครั้ง?`
                    }
                    confirmTone={g.active ? "danger" : "info"}
                  >
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="active" value={g.active ? "false" : "true"} />
                    <Button type="submit" variant={g.active ? "destructive" : "outline"} className="whitespace-nowrap">
                      {g.active ? "ซ่อนประตูน้ำนี้" : "แสดงประตูน้ำนี้"}
                    </Button>
                    {/* WHY: the wording must not suggest it closes the physical gate. */}
                    <p className="text-sm text-muted">ซ่อนจากแผนที่และแดชบอร์ด ไม่มีผลกับประตูน้ำจริง</p>
                  </ActionForm>
                </div>
              </details>
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
