export type GateStatus = {
  pzem: { voltage: number | null; current: number | null; frequency: number | null; power: number | null };
  radar: { liquid: number | null; airGap: number | null };
  float: Record<string, boolean>;
  wireBreak: { red: boolean | null; blue: boolean | null };
  devices: {
    pump: boolean | null;
    alarm: boolean | null;
    light: boolean | null;
    relay1: boolean | null;
    relay2: boolean | null;
  };
  personCount: number | null;
  receivedAt: string;
};

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});

// WHY: 0 is a valid reading; only non-finite / non-number input is "missing". No `?? 0` anywhere.
function num(v: unknown): number | null {
  if (typeof v === "string" && v.trim() === "") return null;
  const n = typeof v === "number" || typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function bool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (v === 0 || v === 1) return v === 1;
  return null;
}

/** First non-null of the candidates, so a 0 reading wins over a later fallback. */
function first<T>(...vals: (T | null)[]): T | null {
  for (const v of vals) if (v !== null) return v;
  return null;
}

/**
 * Accepts Format A ({ stm32: {...} } from ai-receiver) and Format B (flat `stm32/status/all`).
 * Fields with no source in the payload are null. Format A and B keys are never mixed:
 * A wins if `stm32` is an object.
 */
export function parseStatus(payload: unknown, now: Date): GateStatus | null {
  if (!isObj(payload)) return null;

  const a = isObj(payload.stm32) ? payload.stm32 : null;
  const out: GateStatus = {
    pzem: { voltage: null, current: null, frequency: null, power: null },
    radar: { liquid: null, airGap: null },
    float: {},
    wireBreak: { red: null, blue: null },
    devices: { pump: null, alarm: null, light: null, relay1: null, relay2: null },
    personCount: num(payload.person_count),
    receivedAt: now.toISOString(),
  };

  const setFloat = (k: string, v: unknown) => {
    const b = bool(v);
    if (b !== null) out.float[k] = b;
  };

  if (a) {
    const p = obj(a.PZEM);
    out.pzem = { voltage: num(p.voltage), current: num(p.current), frequency: num(p.frequency), power: num(p.power) };

    // WHY: Radar.distance is the sensor-to-surface gap, not the liquid level.
    const r = obj(a.Radar);
    out.radar = { liquid: null, airGap: first(num(r.air), num(r.distance)) };

    const f = obj(a.Floats);
    setFloat("f1", f.upper);
    setFloat("f2", f.lower);
    setFloat("f3", f.f3);

    out.wireBreak.red = bool(a.WireBreak);
    out.devices.pump = bool(obj(a.Pumps).pump1);
    out.devices.alarm = bool(a.Alarm);
  } else {
    const p = obj(payload.pzem);
    out.pzem = {
      voltage: first(num(p.v), num(p.voltage)),
      current: first(num(p.i), num(p.current)),
      frequency: first(num(p.freq), num(p.frequency)),
      power: first(num(p.p), num(p.power)),
    };

    const r = obj(payload.radar);
    out.radar = { liquid: num(r.liquid), airGap: first(num(r.air), num(r.distance)) };

    const f = obj(payload.float);
    setFloat("f1", f.f1);
    setFloat("f2", f.f2);
    setFloat("f3", f.f3);

    const wb = obj(payload.wirebreak);
    out.wireBreak = { red: bool(wb.wb1), blue: bool(wb.wb2) };
    out.devices.pump = bool(payload.pump);
    out.devices.alarm = bool(payload.alarm);
  }

  return out;
}
