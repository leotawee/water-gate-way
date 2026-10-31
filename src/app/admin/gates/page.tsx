import { CircleCheck, CircleSlash } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { requireAdminPage } from "@/lib/auth/dal";
import { listGates } from "@/lib/gatesDb";
import ActionForm from "../_components/ActionForm";
import AdminNav from "../_components/AdminNav";
import { createGate, setGateActive, updateGate } from "../actions";

const input = "input-field w-full";
const label = "flex flex-col gap-1.5 text-sm font-medium text-muted";

/** Shared field set for create and edit. The id is fixed once created (edit sends it as a hidden field). */
function GateFields({ name, location, lat, lng, hasDevice }: { name?: string; location?: string; lat?: number; lng?: number; hasDevice?: boolean }) {
  return (
    <>
      <label className={label}>
        Name
        <input name="name" required maxLength={100} defaultValue={name} className={input} />
      </label>
      <label className={label}>
        Location
        <input name="location" maxLength={200} defaultValue={location} className={input} />
      </label>
      <label className={label}>
        Latitude
        <input name="lat" type="number" step="any" min={-90} max={90} required defaultValue={lat} className={input} />
      </label>
      <label className={label}>
        Longitude
        <input name="lng" type="number" step="any" min={-180} max={180} required defaultValue={lng} className={input} />
      </label>
      <label className="flex items-center gap-2 text-sm font-medium text-muted">
        <input name="hasDevice" type="checkbox" defaultChecked={hasDevice} className="size-4 accent-accent" />
        Has device (STM32 and cameras)
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
        <h1 className="text-xl font-semibold text-fg">Gates</h1>

        <section className="card space-y-4">
          <h2 className="font-semibold text-fg">Add gate</h2>
          <ActionForm action={createGate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className={label}>
              ID (gate-1 to gate-9999)
              <input name="id" required pattern="gate-[0-9]{1,4}" maxLength={9} className={input} />
            </label>
            <GateFields />
            <button type="submit" className="btn-primary justify-self-start">
              Create gate
            </button>
          </ActionForm>
        </section>

        <ul className="space-y-4">
          {gates.map((g) => (
            <li key={g.id} className="card space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-fg">{g.id}</h2>
                {g.active ? (
                  <span className="pill bg-ok/10 text-ok ring-ok/40">
                    <CircleCheck className="size-3.5" aria-hidden="true" />
                    Active
                  </span>
                ) : (
                  <span className="pill bg-surface-2 text-muted ring-border">
                    <CircleSlash className="size-3.5" aria-hidden="true" />
                    Inactive
                  </span>
                )}
              </div>
              <ActionForm action={updateGate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={g.id} />
                <GateFields name={g.name} location={g.location} lat={g.lat} lng={g.lng} hasDevice={g.hasDevice} />
                <button type="submit" className="btn-primary justify-self-start">
                  Save
                </button>
              </ActionForm>
              <ActionForm action={setGateActive}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="active" value={g.active ? "false" : "true"} />
                <button type="submit" className={g.active ? "btn-danger" : "btn-secondary"}>
                  {g.active ? "Deactivate" : "Activate"}
                </button>
              </ActionForm>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
