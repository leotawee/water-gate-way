"use client";

import { useState } from "react";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { isCapsLockOn } from "@/lib/capsLock";

type PasswordFieldProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  invalid?: boolean;
  describedBy?: string;
  hint?: React.ReactNode;
};

export default function PasswordField({
  id,
  name,
  label,
  autoComplete,
  required,
  minLength,
  maxLength,
  invalid,
  describedBy,
  hint,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);

  return (
    <>
      <label htmlFor={id} className="block text-sm font-bold text-fg">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required={required}
          minLength={minLength}
          maxLength={maxLength}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="input-field w-full pr-12"
          onKeyDown={(e) => setCaps(isCapsLockOn(e))}
          onKeyUp={(e) => setCaps(isCapsLockOn(e))}
          onBlur={() => setCaps(false)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label="แสดงรหัสผ่าน"
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex size-11 cursor-pointer items-center justify-center rounded-md text-muted hover:text-fg"
        >
          {visible ? (
            <EyeOff className="size-4" strokeWidth={1.75} aria-hidden="true" />
          ) : (
            <Eye className="size-4" strokeWidth={1.75} aria-hidden="true" />
          )}
        </button>
      </div>
      {hint}
      {/* Reserved status line (cf. DeviceSwitch StatusLine): always one fixed height so toggling
          Caps Lock never shoves the layout. WHY no fade: per-keystroke feedback — the text appearing
          in place reads faster than a 180 ms fade. */}
      <p role="status" className="mt-1.5 flex min-h-5 items-center gap-2 text-sm font-bold text-warn">
        {caps && (
          <>
            <TriangleAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            เปิด Caps Lock อยู่ รหัสผ่านอาจพิมพ์เป็นตัวพิมพ์ใหญ่
          </>
        )}
      </p>
    </>
  );
}
