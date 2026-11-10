"use client";

import { useEffect, useId, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import ActionForm from "./ActionForm";
import { ROLES, ROLE_THAI } from "./shared";
import { createUser } from "../actions";

const label = "flex flex-col gap-1.5 text-sm font-bold text-fg";

/**
 * The create-user form folded into one icon in the page header; the form opens in the app's native
 * <dialog> (same entrance as Modal). Errors surface through ActionForm's own error modal, and a
 * successful create closes the dialog — the table refreshes via the action's revalidatePath.
 */
export default function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const openRef = useRef(open);
  const titleId = useId();

  // Runs before the open/close effect below, so a close we trigger ourselves is already marked as not user-caused.
  useEffect(() => {
    openRef.current = open;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="สร้างผู้ใช้ใหม่"
        title="สร้างผู้ใช้ใหม่"
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-fg transition-colors duration-150 hover:bg-surface-2"
      >
        <UserPlus className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </button>

      <dialog
        ref={ref}
        aria-labelledby={titleId}
        // `close` also fires for our own el.close(); only report a close the user caused.
        onClose={() => {
          if (openRef.current) setOpen(false);
        }}
        // A click on the dialog box itself (outside the inner panel) is a click on the backdrop.
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
        className="modal m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl bg-surface p-0 text-fg shadow-xl backdrop:bg-brand/50"
      >
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tint-blue text-accent">
              <UserPlus className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h2 id={titleId} className="pt-2 text-base font-bold">
              สร้างผู้ใช้
            </h2>
          </div>

          <ActionForm action={createUser} className="mt-5 grid gap-4" onSuccess={() => setOpen(false)} resetOnSuccess>
            <label className={label}>
              อีเมล
              <input name="email" type="email" required maxLength={254} className="input-field w-full" />
            </label>
            <label className={label}>
              บทบาท
              <select name="role" defaultValue="viewer" className="input-field w-full">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_THAI[r]}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              รหัสผ่าน
              <input
                name="password"
                type="password"
                required
                minLength={8}
                maxLength={1024}
                autoComplete="new-password"
                aria-describedby="create-password-rule"
                className="input-field w-full"
              />
            </label>
            <p id="create-password-rule" className="-mt-2 text-sm text-muted">
              รหัสผ่านอย่างน้อย 8 ตัวอักษร
            </p>
            <button type="submit" className="btn-primary w-full">
              สร้างผู้ใช้
            </button>
          </ActionForm>
        </div>
      </dialog>
    </>
  );
}
