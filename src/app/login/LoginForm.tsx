"use client";

import { useActionState, useState } from "react";
import { signIn } from "./actions";
import { CircleAlert } from "lucide-react";
import PasswordField from "@/components/PasswordField";
import RequiredMark from "@/app/admin/_components/RequiredMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const MESSAGES = {
  invalid: "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  rate_limited: "พยายามบ่อยเกินไป ลองอีกครั้งภายหลัง",
} as const;

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, undefined);
  const error = state?.error ? MESSAGES[state.error] : null;
  // WHY: keyed to the state object, not the text, so the same error again after a dismiss reopens the modal.
  const [dismissed, setDismissed] = useState<unknown>(null);
  // WHY: controlled, so React's form reset after the action keeps the email (as in RegisterForm); only the password clears.
  const [email, setEmail] = useState("");

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-1.5">
        <Label htmlFor="email">
          อีเมล <RequiredMark />
        </Label>
        <Input
          id="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="w-full"
        />
      </div>
      <div className="space-y-1.5">
        <PasswordField
          id="password"
          name="password"
          label="รหัสผ่าน"
          autoComplete="current-password"
          required
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-fg">
        <input type="checkbox" name="remember" id="remember" className="size-4 accent-fg" /> จดจำฉันไว้ในอุปกรณ์นี้ 30 วัน
      </label>
      <Button type="submit" disabled={pending} aria-busy={pending} className="w-full">
        {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
      </Button>
      <AlertDialog
        open={!!error && dismissed !== state}
        onOpenChange={(o) => {
          if (!o) setDismissed(state);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-danger-soft text-danger">
              <CircleAlert strokeWidth={1.75} />
            </AlertDialogMedia>
            <AlertDialogTitle>เข้าสู่ระบบไม่สำเร็จ</AlertDialogTitle>
            <AlertDialogDescription>{error}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>ตกลง</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
