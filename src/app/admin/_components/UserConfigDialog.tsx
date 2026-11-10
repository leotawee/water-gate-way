"use client";

import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import ActionForm from "./ActionForm";
import RequiredMark from "./RequiredMark";
import { ROLES, ROLE_THAI } from "./shared";
import { resetUserPassword, setUserDisabled, setUserRole } from "../actions";

type ConfigUser = { id: string; email: string; role: string; disabled: boolean };

/**
 * One dialog that configures one account: role change, password reset, and enable/disable —
 * the row itself stays a single quiet icon. Self-lockout guards mirror the server: an admin
 * cannot change their own role and never sees the disable section. Every successful submit
 * closes the dialog; the row behind it refreshes via the actions' revalidatePath.
 */
export default function UserConfigDialog({ user, isSelf }: { user: ConfigUser; isSelf: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" aria-label={`จัดการบัญชี ${user.email}`} title="จัดการบัญชี">
          <Settings2 strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(26rem,calc(100vw-2rem))] sm:max-w-[26rem]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-tint-blue text-accent">
              <Settings2 className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate">{user.email}</DialogTitle>
              <p className="mt-1.5 flex items-center gap-2 text-sm text-muted">
                {isSelf && <span className="font-bold text-fg">(คุณ)</span>}
                {user.disabled ? (
                  <Badge className="bg-danger-soft text-danger">ปิดใช้งาน</Badge>
                ) : (
                  <Badge className="bg-on-soft text-on">ใช้งาน</Badge>
                )}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-5">
          <section className="grid gap-3">
            <h3 className="text-base font-bold text-fg">บทบาท</h3>
            {isSelf ? (
              <p className="text-sm text-muted">บทบาทของตัวเองเปลี่ยนไม่ได้ — กันผู้ดูแลล็กตัวเองออกจากระบบ</p>
            ) : (
              <ActionForm action={setUserRole} className="flex items-end gap-2" onSuccess={close}>
                <input type="hidden" name="id" value={user.id} />
                <div className="grid flex-1 gap-1.5">
                  <Label htmlFor={`cfg-role-${user.id}`}>บทบาทใหม่</Label>
                  {/* key: remount when the row role changes elsewhere, so the label never lies. */}
                  <Select key={user.role} name="role" defaultValue={user.role}>
                    <SelectTrigger id={`cfg-role-${user.id}`} className="w-full">
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
                <Button type="submit">บันทึก</Button>
              </ActionForm>
            )}
          </section>

          <Separator />

          <section className="grid gap-3">
            <h3 className="text-base font-bold text-fg">ตั้งรหัสผ่านใหม่</h3>
            <ActionForm
              action={resetUserPassword}
              className="grid gap-3"
              confirm={`ตั้งรหัสผ่านใหม่ให้ ${user.email}?`}
              onSuccess={close}
              resetOnSuccess
            >
              <input type="hidden" name="id" value={user.id} />
              <div className="grid gap-1.5">
                <Label htmlFor={`cfg-pw-${user.id}`}>
                  รหัสผ่านใหม่ <RequiredMark />
                </Label>
                <Input
                  id={`cfg-pw-${user.id}`}
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  maxLength={1024}
                  autoComplete="new-password"
                  aria-describedby={`cfg-pw-rule-${user.id}`}
                />
                <span id={`cfg-pw-rule-${user.id}`} className="text-xs text-muted">
                  อย่างน้อย 8 ตัวอักษร
                </span>
              </div>
              <Button type="submit" variant="outline" className="justify-self-start">
                ตั้งรหัสผ่านใหม่
              </Button>
            </ActionForm>
          </section>

          {!isSelf && (
            <>
              <Separator />
              <section className="grid gap-3">
                <h3 className="text-base font-bold text-fg">สถานะบัญชี</h3>
                <ActionForm
                  action={setUserDisabled}
                  confirm={user.disabled ? `เปิดใช้งานบัญชี ${user.email} อีกครั้ง?` : `ปิดใช้งานบัญชี ${user.email}?`}
                  confirmTone={user.disabled ? "info" : "danger"}
                  onSuccess={close}
                >
                  <input type="hidden" name="id" value={user.id} />
                  <input type="hidden" name="disabled" value={user.disabled ? "false" : "true"} />
                  <Button type="submit" variant={user.disabled ? "default" : "destructive"} className="w-full">
                    {user.disabled ? "เปิดใช้งานบัญชีอีกครั้ง" : "ปิดใช้งานบัญชี"}
                  </Button>
                </ActionForm>
                <p className="text-xs text-muted">ปิดใช้งานแล้ว ผู้ใช้รายนี้จะเข้าสู่ระบบไม่ได้ทันที</p>
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
