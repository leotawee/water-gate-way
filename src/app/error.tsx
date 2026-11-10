"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

// WHY: only the digest is shown, never the message or a stack — a production error message can
// carry internals; the digest is the safe key that matches the entry in the server logs.
export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // `digest` is set by Next at runtime but is not on the standard Error type; narrow before reading it.
  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string" ? error.digest : undefined;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6">
        <h1 className="text-xl font-bold text-fg">เกิดข้อผิดพลาดในหน้านี้</h1>
        <p className="mt-2 text-sm text-muted">
          ระบบทำงานผิดปกติชั่วคราว ลองกด &ldquo;ลองอีกครั้ง&rdquo; ถ้ายังไม่หาย ให้กลับไปหน้าแรกแล้วเข้าใหม่
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" onClick={retry}>
            ลองอีกครั้ง
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">กลับหน้าแรก</Link>
          </Button>
        </div>
        {digest && <p className="mt-4 text-xs text-muted tabular-nums">รหัสอ้างอิง: {digest}</p>}
      </div>
    </div>
  );
}
