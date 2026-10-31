import AppHeader from "@/components/AppHeader";
import { requireAdminPage } from "@/lib/auth/dal";
import { listGates } from "@/lib/gatesDb";
import ActionForm from "../_components/ActionForm";
import AdminNav from "../_components/AdminNav";
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
      <label className="flex items-center gap-2 text-sm font-bold text-fg">
        <input name="hasDevice" type="checkbox" defaultChecked={hasDevice} className="size-4 accent-accent" />
        มีอุปกรณ์ (STM32 และกล้อง)
      </label>
    </>
  );
}

export default async function AdminGatesPage() {
  await requireAdminPage("/admin/gates");
  const gates = await listGates({ includeInactive: true });

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader active="admin" isAdmin />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6 sm:px-6">
        <AdminNav />
        <h1 className="text-xl font-bold text-fg">ประตูน้ำ</h1>

        <section className="space-y-4 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-base font-bold text-fg">เพิ่มประตูน้ำ</h2>
          <ActionForm action={createGate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={label}>
              รหัส (gate-1 ถึง gate-9999)
              <input name="id" required pattern="gate-[0-9]{1,4}" maxLength={9} className={input} />
            </label>
            <GateFields />
            <button type="submit" className="btn-primary justify-self-start">
              สร้างประตูน้ำ
            </button>
          </ActionForm>
        </section>

        <ul className="space-y-4">
          {gates.map((g) => (
            <li key={g.id} className="space-y-4 rounded-lg border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold text-fg">{g.name || g.id}</h2>
                {g.active ? (
                  <span className="pill bg-on-soft text-on">
                    <span className="size-2 rounded-full bg-on" aria-hidden="true" />
                    ใช้งาน
                  </span>
                ) : (
                  <span className="pill bg-surface-2 text-muted">
                    <span className="size-2 rounded-full border-2 border-dashed border-muted" aria-hidden="true" />
                    ปิดใช้งาน
                  </span>
                )}
              </div>
              <ActionForm action={updateGate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={g.id} />
                <GateFields name={g.name} location={g.location} lat={g.lat} lng={g.lng} hasDevice={g.hasDevice} />
                <button type="submit" className="btn-primary justify-self-start">
                  บันทึก
                </button>
              </ActionForm>
              <ActionForm action={setGateActive}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="active" value={g.active ? "false" : "true"} />
                <button type="submit" className={g.active ? "btn-danger" : "btn-secondary"}>
                  {g.active ? "ปิดประตูนี้" : "เปิดใช้งาน"}
                </button>
              </ActionForm>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
