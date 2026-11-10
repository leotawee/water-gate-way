"use client";

// The profile editor. The avatar file is compressed to a 256px WebP in the browser (canvas)
// BEFORE upload, so the server only ever receives a small validated WebP and the previous
// picture is replaced in one update.
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadAvatar, updateProfile, removeAvatar, type ProfileState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProfileRow = {
  email: string;
  role: string;
  display_name: string | null;
  phone: string | null;
  line_id: string | null;
  hasAvatar: boolean;
  avatarVersion: string | null; // pg bigint comes back as a string
};

const ROLE_THAI: Record<string, string> = { admin: "ผู้ดูแลระบบ", operator: "ผู้ควบคุม", viewer: "ผู้ชม" };

/** Center-crop to a 256px square and encode WebP (quality 0.85) entirely in the browser. */
async function compressToWebp(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  bmp.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
  // WHY reject: older Safari silently falls back to PNG; the server only accepts WebP.
  if (!blob || blob.type !== "image/webp") throw new Error("webp-unsupported");
  return blob;
}

function AvatarBlock({ row }: { row: ProfileRow }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(uploadAvatar, undefined);
  const [removeState, removeAction, removing] = useActionState(removeAvatar, undefined);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [compressError, setCompressError] = useState<string | null>(null);
  const version = row.hasAvatar && row.avatarVersion ? `?v=${row.avatarVersion}` : null;

  // A successful upload changed avatar_updated_at on the server: refresh server components
  // (the profile avatar and any other place that renders it).
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const onFile = async (f: File | undefined) => {
    setCompressError(null);
    setFile(null);
    setPreview(null);
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      setCompressError("รูปใหญ่เกิน 10 MB");
      return;
    }
    try {
      const blob = await compressToWebp(f);
      setFile(new File([blob], "avatar.webp", { type: "image/webp" }));
      setPreview(URL.createObjectURL(blob));
    } catch {
      setCompressError("เบราว์เซอร์นี้บีบอัด WebP ไม่ได้ ลองใช้ Chrome/Edge");
    }
  };

  return (
    <div className="flex items-start gap-4">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- the preview is a client-side object URL
        <img src={preview} alt="ตัวอย่างรูปใหม่" className="size-20 shrink-0 rounded-2xl object-cover" />
      ) : version ? (
        <img src={`/api/users/me/avatar${version}`} alt="" className="size-20 shrink-0 rounded-2xl object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-20 shrink-0 place-items-center rounded-2xl bg-surface-2 text-xl font-bold text-muted"
        >
          {(row.display_name || row.email).slice(0, 1).toUpperCase()}
        </span>
      )}

      <div className="min-w-0 text-sm">
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            id="avatar-file"
            name="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button variant="outline" asChild>
            <label htmlFor="avatar-file" className="cursor-pointer">
              เลือกรูปใหม่…
            </label>
          </Button>
          {file && (
            <Button
              type="submit"
              disabled={pending}
              className="disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "กำลังอัปโหลด…" : "อัปโหลดรูปนี้"}
            </Button>
          )}
        </form>
        <p className="mt-1 text-muted">
          {compressError ? (
            <span className="font-bold text-danger">{compressError}</span>
          ) : (
            "JPG/PNG ใดก็ได้ ระบบจะครอบเป็นจัตุรัส 256px และบีบอัดเป็น WebP ก่อนบันทึก"
          )}
          {removeState?.error && <span className="ml-2 font-bold text-danger">{removeState.error}</span>}
        </p>
        {row.hasAvatar && !pending && (
          <form action={removeAction} className="mt-1">
            <Button type="submit" variant="ghostDanger" size="sm" className="min-h-11 px-2.5" disabled={removing}>
              ลบรูปโปรไฟล์
            </Button>
            {removeState?.ok && <span className="ml-2 text-on">ลบแล้ว</span>}
          </form>
        )}
        {state?.ok && (
          <span className="text-on">อัปโหลดแล้ว — ระบบบันทึกรูปใหม่แทนรูปเก่าแล้ว</span>
        )}
        {state?.error && <span className="ml-2 font-bold text-danger">{state.error}</span>}
      </div>
    </div>
  );
}

export default function ProfileForm({ row }: { row: ProfileRow }) {
  const [state, formAction, pending] = useActionState(updateProfile, undefined);

  return (
    <div className="space-y-6">
      <section aria-labelledby="avatar-heading">
        <h3 id="avatar-heading" className="mb-3 text-sm font-bold text-fg">
          รูปโปรไฟล์
        </h3>
        <AvatarBlock row={row} />
      </section>

      <section aria-labelledby="contact-heading">
        <h3 id="contact-heading" className="mb-3 text-sm font-bold text-fg">
          ข้อมูลติดต่อ
        </h3>
        <form action={formAction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-bold text-fg">
            ชื่อที่แสดง
            <Input
              name="display_name"
              defaultValue={row.display_name ?? ""}
              maxLength={60}
              placeholder="เช่น สมชาย ใจดี"
              className="w-full"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-fg">
            เบอร์โทรศัพท์
            <Input
              name="phone"
              defaultValue={row.phone ?? ""}
              inputMode="tel"
              maxLength={20}
              placeholder="08x-xxx-xxxx"
              className="w-full"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-fg">
            LINE ID
            <Input
              name="line_id"
              defaultValue={row.line_id ?? ""}
              maxLength={60}
              placeholder="ป้อนได้เฉพาะ a-z 0-9 . _ -"
              className="w-full"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-bold text-fg">
            อีเมล (ใช้เข้าสู่ระบบ — แก้ไม่ได้)
            <Input value={row.email} readOnly className="w-full opacity-60" />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={pending} className="disabled:cursor-not-allowed disabled:opacity-60">
              {pending ? "กำลังบันทึก…" : "บันทึกข้อมูลติดต่อ"}
            </Button>
            {state?.ok && <span className="text-sm font-bold text-on">บันทึกแล้ว</span>}
            {state?.error && <span className="text-sm font-bold text-danger">{state.error}</span>}
          </div>
        </form>
      </section>
    </div>
  );
}
