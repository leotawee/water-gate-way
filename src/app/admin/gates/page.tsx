import { ChevronDown, MapPin, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/auth/dal";
import { listGates } from "@/lib/gatesDb";
import StatePill from "@/components/StatePill";
import ActionForm from "../_components/ActionForm";
import AdminShell from "../_components/AdminShell";
import FilterForm from "../_components/FilterForm";
import { firstParam } from "../_components/shared";
import { createGate, setGateActive, updateGate } from "../actions";

const input = "input-field w-full";
const label = "flex flex-col gap-1.5 text-sm font-bold text-fg";

/** Shared field set for create and edit. The id is fixed once created (edit sends it as a hidden field). */
function GateFields({ name, location, lat, lng, hasDevice }: { name?: string; location?: string; lat?: number; lng?: number; hasDevice?: boolean }) {
  return (
    <>
      <label className={label}>
        ชื่อ
        <input name="name" required maxLength={100} defaultValue={name} className={input} />
      </label>
      <label className={label}>
        ที่ตั้ง
        <input name="location" maxLength={200} defaultValue={location} className={input} />
      </label>
      <label className={label}>
        ละติจูด
        <input name="lat" type="number" step="any" min={-90} max={90} required defaultValue={lat} className={input} />
      </label>
      <label className={label}>
        ลองจิจูด
        <input name="lng" type="number" step="any" min={-180} max={180} required defaultValue={lng} className={input} />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-bold text-fg sm:col-span-2">
        <input name="hasDevice" type="checkbox" defaultChecked={hasDevice} className="size-4 accent-fg" />
        มีอุปกรณ์ (STM32 และกล้อง)
      </label>
    </>
  );
}

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
    >
      <FilterForm
        ariaLabel="กรองประตูน้ำ"
        className="mb-4 flex flex-wrap items-end gap-x-4 gap-y-3 rounded-lg border border-border bg-surface px-5 py-4"
      >
        <label className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm font-bold text-fg sm:max-w-64">
          ค้นหา
          <input name="q" type="search" defaultValue={q} placeholder="ชื่อ รหัส หรือที่ตั้ง…" className="input-field w-full" />
        </label>
        <label className={label}>
          สถานะ
          <select name="status" defaultValue={status} className="input-field w-40">
            <option value="">ทั้งหมด</option>
            <option value="shown">แสดงบนแผนที่</option>
            <option value="hidden">ซ่อนอยู่</option>
          </select>
        </label>
        <label className={label}>
          เรียงตาม
          <select name="sort" defaultValue={sort} className="input-field w-40">
            <option value="name">ชื่อ</option>
            <option value="id">รหัส</option>
          </select>
        </label>
      </FilterForm>

      <div className="rounded-lg border border-border bg-surface">
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
                    {g.hasDevice ? <StatePill tone="on">มีอุปกรณ์</StatePill> : <StatePill tone="off">ยังไม่ติดตั้ง</StatePill>}
                  </span>
                  {/* WHY: only the exception gets a mark; a visible gate is the normal case. */}
                  {!g.active && <StatePill tone="off">ซ่อนอยู่</StatePill>}
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
                    <button type="submit" className="btn-primary justify-self-start whitespace-nowrap">
                      บันทึกการแก้ไข
                    </button>
                  </ActionForm>
                  <ActionForm
                    action={setGateActive}
                    className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md bg-bg px-4 py-3"
                    confirm={
                      g.active
                        ? `ซ่อน “${g.name || g.id}” จากแผนที่และแดชบอร์ด?`
                        : `แสดง “${g.name || g.id}” บนแผนที่อีกครั้ง?`
                    }
                  >
                    <input type="hidden" name="id" value={g.id} />
                    <input type="hidden" name="active" value={g.active ? "false" : "true"} />
                    <button type="submit" className={`${g.active ? "btn-danger" : "btn-secondary"} whitespace-nowrap`}>
                      {g.active ? "ซ่อนประตูน้ำนี้" : "แสดงประตูน้ำนี้"}
                    </button>
                    {/* WHY: the wording must not suggest it closes the physical gate. */}
                    <p className="text-sm text-muted">ซ่อนจากแผนที่และแดชบอร์ด ไม่มีผลกับประตูน้ำจริง</p>
                  </ActionForm>
                </div>
              </details>
            </li>
          ))}
          {list.length === 0 && (
            <li className="px-5 py-4 text-sm text-muted">
              {filtered ? "ไม่มีประตูน้ำที่ตรงกับตัวกรอง" : "ยังไม่มีประตูน้ำ เพิ่มประตูแรกด้านล่าง"}
            </li>
          )}
        </ul>
      </div>

      <section aria-labelledby="create-gate-heading" className="mt-6 rounded-lg border border-border bg-surface p-5">
        <h2 id="create-gate-heading" className="text-base font-bold text-fg">
          เพิ่มประตูน้ำ
        </h2>
        <ActionForm action={createGate} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={label}>
            รหัส
            <input
              name="id"
              required
              pattern="gate-[0-9]{1,4}"
              maxLength={9}
              aria-describedby="gate-id-rule"
              className={input}
            />
            <span id="gate-id-rule" className="text-sm font-normal text-muted">
              รูปแบบ gate-1 ถึง gate-9999 แก้ไม่ได้หลังสร้าง
            </span>
          </label>
          <GateFields />
          <button type="submit" className="btn-primary justify-self-start whitespace-nowrap">
            เพิ่มประตูน้ำ
          </button>
        </ActionForm>
      </section>
    </AdminShell>
  );
}
