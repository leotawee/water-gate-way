"use client";

import { useState } from "react";
import { MapPinPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import ActionForm from "./ActionForm";
import GateFields from "./GateFields";
import RequiredMark from "./RequiredMark";
import { createGate } from "../actions";

/**
 * The create-gate form folded into one icon in the page header (same pattern as CreateUserDialog):
 * a confirm step before submit, action errors surface in an alert dialog, and a successful create
 * closes the dialog while the list refreshes via the action's revalidatePath.
 */
export default function CreateGateDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="เพิ่มประตูน้ำใหม่" title="เพิ่มประตูน้ำ">
          <MapPinPlus strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(26rem,calc(100vw-2rem))] sm:max-w-[26rem]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tint-blue text-accent">
              <MapPinPlus className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <DialogTitle>เพิ่มประตูน้ำ</DialogTitle>
          </div>
        </DialogHeader>

        <ActionForm
          action={createGate}
          className="grid gap-4"
          confirm="ยืนยันเพิ่มประตูน้ำนี้?"
          confirmTone="info"
          onSuccess={() => setOpen(false)}
          resetOnSuccess
        >
          <div className="grid gap-1.5">
            <Label htmlFor="create-gate-id">
              รหัส <RequiredMark />
            </Label>
            <Input
              id="create-gate-id"
              name="id"
              required
              pattern="gate-[0-9]{1,4}"
              maxLength={9}
              aria-describedby="gate-id-rule"
            />
            <span id="gate-id-rule" className="text-xs text-muted">
              รูปแบบ gate-1 ถึง gate-9999 แก้ไม่ได้หลังสร้าง
            </span>
          </div>
          <GateFields />
          <Button type="submit" className="mt-1 w-full">
            เพิ่มประตูน้ำ
          </Button>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
