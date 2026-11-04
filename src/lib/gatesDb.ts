import "server-only";
import { db } from "@/lib/db";
import { GATE_ID_RE, type Gate } from "@/lib/gates";

// Admin pages need the extra fields; the map and dashboard only read the Gate subset.
export type GateRecord = Gate & { location: string; active: boolean };

type GateRow = {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  has_device: boolean;
  active: boolean;
};

const toRecord = (r: GateRow): GateRecord => ({
  id: r.id,
  name: r.name,
  location: r.location,
  lat: r.lat,
  lng: r.lng,
  hasDevice: r.has_device,
  active: r.active,
});

export async function listGates({ includeInactive = false }: { includeInactive?: boolean } = {}): Promise<GateRecord[]> {
  const { rows } = await db.query(
    "select id, name, location, lat, lng, has_device, active from gates where active or $1 order by length(id), id",
    [includeInactive],
  );
  return (rows as GateRow[]).map(toRecord);
}

/** Active gate by id, or null (missing, inactive or malformed id). */
export async function getGate(id: string | undefined): Promise<Gate | null> {
  if (typeof id !== "string" || !GATE_ID_RE.test(id)) return null;
  const { rows } = await db.query("select id, name, lat, lng, has_device from gates where id = $1 and active", [id]);
  const r = rows[0] as Pick<GateRow, "id" | "name" | "lat" | "lng" | "has_device"> | undefined;
  return r ? { id: r.id, name: r.name, lat: r.lat, lng: r.lng, hasDevice: r.has_device } : null;
}
