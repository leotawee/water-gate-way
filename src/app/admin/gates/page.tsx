import { requireAdminPage } from "@/lib/auth/dal";
import { listGates } from "@/lib/gatesDb";
import ActionForm from "../_components/ActionForm";
import AdminNav from "../_components/AdminNav";
import { createGate, setGateActive, updateGate } from "../actions";

const input = "rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500";
const button = "rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-1.5 transition-colors";

/** Shared field set for create and edit. The id is fixed once created (edit sends it as a hidden field). */
function GateFields({ name, location, lat, lng, hasDevice }: { name?: string; location?: string; lat?: number; lng?: number; hasDevice?: boolean }) {
  return (
    <>
      <label className="flex flex-col text-sm text-gray-700">
        Name
        <input name="name" required maxLength={100} defaultValue={name} className={input} />
      </label>
      <label className="flex flex-col text-sm text-gray-700">
        Location
        <input name="location" maxLength={200} defaultValue={location} className={input} />
      </label>
      <label className="flex flex-col text-sm text-gray-700">
        Latitude
        <input name="lat" type="number" step="any" min={-90} max={90} required defaultValue={lat} className={input} />
      </label>
      <label className="flex flex-col text-sm text-gray-700">
        Longitude
        <input name="lng" type="number" step="any" min={-180} max={180} required defaultValue={lng} className={input} />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input name="hasDevice" type="checkbox" defaultChecked={hasDevice} />
        Has device (STM32 and cameras)
      </label>
    </>
  );
}

export default async function AdminGatesPage() {
  await requireAdminPage("/admin/gates");
  const gates = await listGates({ includeInactive: true });

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <AdminNav />
        <h1 className="text-2xl font-bold text-gray-900">Gates</h1>

        <section className="bg-white rounded-xl shadow-sm p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Add gate</h2>
          <ActionForm action={createGate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col text-sm text-gray-700">
              ID (gate-1 to gate-9999)
              <input name="id" required pattern="gate-[0-9]{1,4}" maxLength={9} className={input} />
            </label>
            <GateFields />
            <button type="submit" className={`${button} justify-self-start`}>
              Create gate
            </button>
          </ActionForm>
        </section>

        <ul className="space-y-4">
          {gates.map((g) => (
            <li key={g.id} className="bg-white rounded-xl shadow-sm p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{g.id}</h2>
                <span className={`text-sm font-semibold ${g.active ? "text-green-700" : "text-gray-500"}`}>
                  {g.active ? "Active" : "Inactive"}
                </span>
              </div>
              <ActionForm action={updateGate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="hidden" name="id" value={g.id} />
                <GateFields name={g.name} location={g.location} lat={g.lat} lng={g.lng} hasDevice={g.hasDevice} />
                <button type="submit" className={`${button} justify-self-start`}>
                  Save
                </button>
              </ActionForm>
              <ActionForm action={setGateActive}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="active" value={g.active ? "false" : "true"} />
                <button type="submit" className={button}>
                  {g.active ? "Deactivate" : "Activate"}
                </button>
              </ActionForm>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
