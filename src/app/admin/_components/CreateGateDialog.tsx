"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPinPlus } from "lucide-react";
import ActionForm from "./ActionForm";
import GateFields from "./GateFields";
import RequiredMark from "./RequiredMark";
import { createGate } from "../actions";

const label = "flex flex-col gap-1.5 text-sm font-bold text-fg";

/**
 * The create-gate form folded into one icon in the page header (same pattern as CreateUserDialog):
 * a confirm step before submit, action errors surface in a modal, and a successful create closes
 * the dialog while the list refreshes via the action's revalidatePath.
 */
export default function CreateGateDialog() {
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
        aria-label="เพิ่มประตูน้ำใหม่"
        title="เพิ่มประตูน้ำ"
        className="inline-flex size-11 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-fg transition-colors duration-150 hover:bg-surface-2"
      >
        <MapPinPlus className="size-5" strokeWidth={1.75} aria-hidden="true" />
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
              <MapPinPlus className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <h2 id={titleId} className="pt-2 text-base font-bold">
              เพิ่มประตูน้ำ
            </h2>
          </div>

          <ActionForm
            action={createGate}
            className="mt-5 grid gap-4"
            confirm="ยืนยันเพิ่มประตูน้ำนี้?"
            confirmTone="info"
            onSuccess={() => setOpen(false)}
            resetOnSuccess
          >
            <label className={label}>
              รหัส <RequiredMark />
              <input
                name="id"
                required
                pattern="gate-[0-9]{1,4}"
                maxLength={9}
                aria-describedby="gate-id-rule"
                className="input-field w-full"
              />
              <span id="gate-id-rule" className="text-sm font-normal text-muted">
                รูปแบบ gate-1 ถึง gate-9999 แก้ไม่ได้หลังสร้าง
              </span>
            </label>
            <GateFields />
            <button type="submit" className="btn-primary w-full">
              เพิ่มประตูน้ำ
            </button>
          </ActionForm>
        </div>
      </dialog>
    </>
  );
}
