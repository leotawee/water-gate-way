"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { clientIp } from "@/lib/http/clientIp";

// WHY: a Server Action is a public POST endpoint; every action re-checks the role and takes the actor from requireUser.
export type AdminState = { error?: string } | undefined;

const ROLES = ["viewer", "operator", "admin"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GATE_ID = /^gate-[0-9]{1,4}$/;
// WHY: same shape as scripts/create-user.ts; the 254 cap is the email length limit.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 1024;

/** String form value no longer than max; null when missing or too long. */
function field(form: FormData, key: string, max: number): string | null {
  const v = form.get(key);
  return typeof v === "string" && v.length <= max ? v : null;
}

function parseCoord(v: FormDataEntryValue | null, limit: number): number | null {
  // WHY: Number("") is 0, so empty input must be rejected before the range check.
  if (typeof v !== "string" || v.trim() === "" || v.length > 20) return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

type GateInput = { name: string; location: string; lat: number; lng: number; hasDevice: boolean };

function parseGate(form: FormData): GateInput | null {
  const name = (field(form, "name", 100) ?? "").trim();
  const location = field(form, "location", 200);
  const lat = parseCoord(form.get("lat"), 90);
  const lng = parseCoord(form.get("lng"), 180);
  if (name === "" || location === null || lat === null || lng === null) return null;
  return { name, location: location.trim(), lat, lng, hasDevice: form.get("hasDevice") === "on" };
}

// WHY: the audit row holds ids only, never an email or password; the ip comes from the same proxy rules as login.
async function audit(actorId: string, action: string, target: string): Promise<void> {
  await db.query("insert into admin_audit (actor_id, action, target, ip) values ($1, $2, $3, $4)", [
    actorId,
    action,
    target,
    clientIp(await headers()),
  ]);
}

const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === "23505";

export async function createUser(_prev: AdminState, form: FormData): Promise<AdminState> {
  const actor = await requireUser("admin");
  const email = (field(form, "email", 254) ?? "").trim().toLowerCase();
  const role = field(form, "role", 16) ?? "";
  const password = field(form, "password", PASSWORD_MAX);
  if (!EMAIL.test(email)) return { error: "รูปแบบอีเมลไม่ถูกต้อง" };
  if (!ROLES.includes(role)) return { error: "เลือกบทบาทไม่ถูกต้อง" };
  if (password === null || password.length < PASSWORD_MIN) return { error: "รหัสผ่านต้องมี 8 ถึง 1024 ตัวอักษร" };

  const passwordHash = await hashPassword(password);
  let id: string;
  try {
    const { rows } = await db.query(
      "insert into users (email, password_hash, role) values ($1, $2, $3) returning id",
      [email, passwordHash, role],
    );
    id = (rows[0] as { id: string }).id;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "อีเมลนี้มีบัญชีอยู่แล้ว" };
    throw e;
  }
  await audit(actor.id, "user.create", `user:${id}`);
  revalidatePath("/admin/users");
}

export async function setUserRole(_prev: AdminState, form: FormData): Promise<AdminState> {
  const actor = await requireUser("admin");
  const id = field(form, "id", 36) ?? "";
  const role = field(form, "role", 16) ?? "";
  if (!UUID.test(id) || !ROLES.includes(role)) return { error: "คำขอไม่ถูกต้อง" };
  // WHY: an admin who demotes themselves can lock every admin out of the panel.
  if (id === actor.id && role !== "admin") return { error: "ลดระดับบัญชีของตนเองไม่ได้" };

  const { rowCount } = await db.query("update users set role = $1 where id = $2", [role, id]);
  if (!rowCount) return { error: "ไม่พบผู้ใช้" };
  await audit(actor.id, `user.role:${role}`, `user:${id}`);
  revalidatePath("/admin/users");
}

export async function setUserDisabled(_prev: AdminState, form: FormData): Promise<AdminState> {
  const actor = await requireUser("admin");
  const id = field(form, "id", 36) ?? "";
  const flag = field(form, "disabled", 5);
  if (!UUID.test(id) || (flag !== "true" && flag !== "false")) return { error: "คำขอไม่ถูกต้อง" };
  const disabled = flag === "true";
  if (disabled && id === actor.id) return { error: "ปิดใช้งานบัญชีของตนเองไม่ได้" };

  const { rowCount } = await db.query("update users set disabled = $1 where id = $2", [disabled, id]);
  if (!rowCount) return { error: "ไม่พบผู้ใช้" };
  // WHY: getSessionUser already rejects disabled users; deleting their sessions ends them now and leaves no stale rows.
  if (disabled) await db.query("delete from sessions where user_id = $1", [id]);
  await audit(actor.id, disabled ? "user.disable" : "user.enable", `user:${id}`);
  revalidatePath("/admin/users");
}

export async function resetUserPassword(_prev: AdminState, form: FormData): Promise<AdminState> {
  const actor = await requireUser("admin");
  const id = field(form, "id", 36) ?? "";
  const password = field(form, "password", PASSWORD_MAX);
  if (!UUID.test(id)) return { error: "คำขอไม่ถูกต้อง" };
  if (password === null || password.length < PASSWORD_MIN) return { error: "รหัสผ่านต้องมี 8 ถึง 1024 ตัวอักษร" };

  const passwordHash = await hashPassword(password);
  const { rowCount } = await db.query("update users set password_hash = $1 where id = $2", [passwordHash, id]);
  if (!rowCount) return { error: "ไม่พบผู้ใช้" };
  // WHY: sessions opened before the reset must not survive it.
  await db.query("delete from sessions where user_id = $1", [id]);
  await audit(actor.id, "user.password_reset", `user:${id}`);
  revalidatePath("/admin/users");
}

export async function createGate(_prev: AdminState, form: FormData): Promise<AdminState> {
  const actor = await requireUser("admin");
  const id = field(form, "id", 16) ?? "";
  const gate = parseGate(form);
  if (!GATE_ID.test(id) || !gate) return { error: "ตรวจสอบรหัส ชื่อ ที่ตั้ง และพิกัดของประตูน้ำ" };

  try {
    await db.query(
      "insert into gates (id, name, location, lat, lng, has_device, active) values ($1, $2, $3, $4, $5, $6, true)",
      [id, gate.name, gate.location, gate.lat, gate.lng, gate.hasDevice],
    );
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `${id} มีอยู่แล้ว` };
    throw e;
  }
  await audit(actor.id, "gate.create", `gate:${id}`);
  revalidatePath("/admin/gates");
  revalidatePath("/");
}

// WHY: the id is not editable (it is in every URL and in the audit trail); only the fields below change.
export async function updateGate(_prev: AdminState, form: FormData): Promise<AdminState> {
  const actor = await requireUser("admin");
  const id = field(form, "id", 16) ?? "";
  const gate = parseGate(form);
  if (!GATE_ID.test(id) || !gate) return { error: "ตรวจสอบชื่อ ที่ตั้ง และพิกัดของประตูน้ำ" };

  const { rowCount } = await db.query(
    "update gates set name = $1, location = $2, lat = $3, lng = $4, has_device = $5, updated_at = now() where id = $6",
    [gate.name, gate.location, gate.lat, gate.lng, gate.hasDevice, id],
  );
  if (!rowCount) return { error: "ไม่พบประตูน้ำ" };
  await audit(actor.id, "gate.update", `gate:${id}`);
  revalidatePath("/admin/gates");
  revalidatePath("/");
}

// WHY: gates are deactivated, never deleted; an inactive gate 404s on the dashboard and leaves the map.
export async function setGateActive(_prev: AdminState, form: FormData): Promise<AdminState> {
  const actor = await requireUser("admin");
  const id = field(form, "id", 16) ?? "";
  const flag = field(form, "active", 5);
  if (!GATE_ID.test(id) || (flag !== "true" && flag !== "false")) return { error: "คำขอไม่ถูกต้อง" };

  const { rowCount } = await db.query("update gates set active = $1, updated_at = now() where id = $2", [flag === "true", id]);
  if (!rowCount) return { error: "ไม่พบประตูน้ำ" };
  await audit(actor.id, flag === "true" ? "gate.activate" : "gate.deactivate", `gate:${id}`);
  revalidatePath("/admin/gates");
  revalidatePath("/");
}
