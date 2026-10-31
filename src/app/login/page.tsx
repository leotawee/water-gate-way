import type { Metadata } from "next";
import { Waves } from "lucide-react";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Water Gate Way" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { next } = await searchParams;
  // safeNext() in the action validates this; here it is only passed through.
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10">
      <div className="flex w-full max-w-sm flex-col items-center">
        <span className="mb-3 flex size-12 items-center justify-center rounded-lg border border-border bg-surface">
          <Waves className="size-6 text-accent" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold text-fg">Water Gate Way</h1>
        <p className="mt-1 text-sm text-muted">ระบบติดตามและควบคุมประตูน้ำ</p>
        <div className="mt-6 w-full rounded-lg border border-border bg-surface p-6 sm:p-8">
          <LoginForm next={typeof next === "string" ? next : ""} />
        </div>
      </div>
    </main>
  );
}
