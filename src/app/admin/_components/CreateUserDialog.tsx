"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ActionForm from "./ActionForm";
import RequiredMark from "./RequiredMark";
import { ROLES, ROLE_THAI } from "./shared";
import { createUser } from "../actions";

/**
 * The create-user form folded into one icon in the page header: Radix Dialog (focus trap, Esc,
 * top layer), action errors surface through ActionForm's alert dialog, and a successful create
 * closes the dialog — the table refreshes via the action's revalidatePath.
 */
export default function CreateUserDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label="สร้างผู้ใช้ใหม่" title="สร้างผู้ใช้ใหม่">
          <UserPlus strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(26rem,calc(100vw-2rem))] sm:max-w-[26rem]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tint-blue text-accent">
              <UserPlus className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <DialogTitle>สร้างผู้ใช้</DialogTitle>
          </div>
        </DialogHeader>

        <ActionForm action={createUser} className="grid gap-4" onSuccess={() => setOpen(false)} resetOnSuccess>
          <div className="grid gap-1.5">
            <Label htmlFor="create-user-email">
              อีเมล <RequiredMark />
            </Label>
            <Input id="create-user-email" name="email" type="email" required maxLength={254} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="create-user-role">บทบาท</Label>
            <Select name="role" defaultValue="viewer">
              <SelectTrigger id="create-user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_THAI[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="create-user-password">
              รหัสผ่าน <RequiredMark />
            </Label>
            <Input
              id="create-user-password"
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={1024}
              autoComplete="new-password"
              aria-describedby="create-password-rule"
            />
            <span id="create-password-rule" className="text-xs text-muted">
              รหัสผ่านอย่างน้อย 8 ตัวอักษร
            </span>
          </div>
          <Button type="submit" className="mt-1 w-full">
            สร้างผู้ใช้
          </Button>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
