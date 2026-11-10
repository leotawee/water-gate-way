"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/dal";
import { clientIp } from "@/lib/http/clientIp";
import { isWebpBytes } from "@/lib/profile/webp";

export type ProfileState = { ok?: boolean; error?: string } | undefined;

const clean = (v: FormDataEntryValue | null, max: number): string =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

/** WebP magic bytes: "RIFF" .... "WEBP". The upload path never trusts the declared mime type. */
async function audit(userId: string, action: string, detail = ""): Promise<void> {
  await db.query("insert into action_audit (user_id, action, detail, ip) values ($1, $2, $3, $4)", [
    userId,
    action,
    detail,
    clientIp(await headers()),
  ]);
}

export async function updateProfile(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: "ต้องเข้าสู่ระบบก่อน" };
  }

  const displayName = clean(form.get("display_name"), 60);
  const phone = clean(form.get("phone"), 20);
  const lineId = clean(form.get("line_id"), 60);
  // WHY \p{M}: Thai vowels above/below and tone marks (ี ่ ้ …) are combining marks, not letters —
  // without them almost every Thai name is rejected.
  if (displayName && !/^[\p{L}\p{M}\p{N}\s.'-]+$/u.test(displayName)) return { error: "ชื่อแสดงผลมีตัวอักษรที่ไม่รองรับ" };
  if (phone && !/^[0-9+\-\s()]{6,20}$/.test(phone)) return { error: "เบอร์โทรไม่ถูกต้อง (6–20 ตัวเลข/สัญลักษณ์โทรศัพท์)" };
  if (lineId && !/^[A-Za-z0-9._-]{4,60}$/.test(lineId)) return { error: "LINE ID ใช้ได้เฉพาะ a-z 0-9 . _ - (4–60 ตัว)" };

  try {
    await db.query(
      "update users set display_name = nullif($1, ''), phone = nullif($2, ''), line_id = nullif($3, '') where id = $4",
      [displayName, phone, lineId, user.id],
    );
    // WHY coarse detail: the values live in the users row; the audit only records what changed.
    await audit(
      user.id,
      "profile.update",
      `name=${displayName ? "set" : "-"} phone=${phone ? "set" : "-"} line=${lineId ? "set" : "-"}`,
    );
  } catch (e) {
    console.error("[profile/updateProfile] failed:", e);
    return { error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" };
  }
  revalidatePath("/profile");
  return { ok: true };
}

// WHY 300 KB: the client compresses to a 256px WebP (~10-40 KB); anything bigger is not from our
// compressor. WHY magic bytes: the declared mime type comes from the client and is not trusted.
const MAX_AVATAR_BYTES = 300_000;

export async function uploadAvatar(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: "ต้องเข้าสู่ระบบก่อน" };
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "ไม่พบไฟล์รูป" };
  if (file.size > MAX_AVATAR_BYTES) return { error: "รูปใหญ่เกิน (สูงสุด 300 KB หลังบีบอัด)" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isWebpBytes(bytes)) return { error: "ต้องเป็นไฟล์ WebP จากตัวบีบอัดของหน้าโปรไฟล์" };

  try {
    await db.query("update users set avatar_webp = $1, avatar_updated_at = now() where id = $2", [bytes, user.id]);
    await audit(user.id, "avatar.update", `${bytes.length}B`);
  } catch (e) {
    console.error("[profile/uploadAvatar] failed:", e);
    return { error: "บันทึกไม่สำเร็จ ลองอีกครั้ง" };
  }
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeAvatar(_prev: ProfileState): Promise<ProfileState> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { error: "ต้องเข้าสู่ระบบก่อน" };
  }
  try {
    await db.query("update users set avatar_webp = null, avatar_updated_at = now() where id = $1", [user.id]);
    await audit(user.id, "avatar.remove");
  } catch (e) {
    console.error("[profile/removeAvatar] failed:", e);
    return { error: "ลบไม่สำเร็จ ลองอีกครั้ง" };
  }
  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { ok: true };
}
