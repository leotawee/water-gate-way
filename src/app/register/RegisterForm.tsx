"use client";

import { useActionState, useState } from "react";
import { register, type RegisterState } from "./actions";
import PasswordField from "@/components/PasswordField";
import Modal from "@/components/Modal";

function message(state: RegisterState): string | null {
  switch (state?.error) {
    case "email":
      return "รูปแบบอีเมลไม่ถูกต้อง";
    case "password":
      return "รหัสผ่านต้องมี 8 ถึง 1024 ตัวอักษร";
    case "mismatch":
      return "รหัสผ่านทั้งสองช่องไม่ตรงกัน";
    case "rate_limited":
      return `สมัครบ่อยเกินไป ลองอีกครั้งใน ${Math.ceil((state.retryAfterSec ?? 60) / 60)} นาที`;
    default:
      return null;
  }
}

export default function RegisterForm() {
  const [state, action, pending] = useActionState(register, undefined);
  // WHY: controlled, so React's reset after the action leaves the email in place; the passwords clear.
  const [email, setEmail] = useState("");
  const error = message(state);
  // WHY: keyed to the state object, not the text, so the same error again after a dismiss reopens the modal.
  const [dismissed, setDismissed] = useState<unknown>(null);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-bold text-fg">
          อีเมล
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          maxLength={254}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={state?.error === "email" || undefined}
          className="input-field w-full"
        />
      </div>
      <div className="space-y-1.5">
        <PasswordField
          id="password"
          name="password"
          label="รหัสผ่าน"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={1024}
          describedBy="password-rule"
          invalid={state?.error === "password"}
          hint={
            <p id="password-rule" className="text-sm text-muted">
              อย่างน้อย 8 ตัวอักษร
            </p>
          }
        />
      </div>
      <div className="space-y-1.5">
        <PasswordField
          id="confirm"
          name="confirm"
          label="ยืนยันรหัสผ่าน"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={1024}
          invalid={state?.error === "mismatch"}
        />
      </div>
      <button type="submit" disabled={pending} aria-busy={pending} className="btn-primary w-full">
        {pending ? "กำลังสมัคร…" : "สมัครใช้งาน"}
      </button>
      <Modal
        open={!!error && dismissed !== state}
        onClose={() => setDismissed(state)}
        title="สมัครใช้งานไม่สำเร็จ"
        tone="danger"
      >
        {error}
      </Modal>
    </form>
  );
}
