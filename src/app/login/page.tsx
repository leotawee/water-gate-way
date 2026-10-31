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
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-bg px-4 py-10">
      {/* Decorative accent glow behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/4 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-3xl"
      />
      <div className="relative flex w-full max-w-sm flex-col items-center">
        <span className="mb-4 flex size-12 items-center justify-center rounded-xl bg-accent/10 ring-1 ring-inset ring-accent/30">
          <Waves className="size-6 text-accent" aria-hidden="true" />
        </span>
        <h1 className="mb-6 text-2xl font-semibold text-fg">Water Gate Way</h1>
        <div className="w-full rounded-xl border border-border bg-surface p-6 shadow-2xl shadow-black/40 sm:p-8">
          <h2 className="mb-6 text-lg font-semibold text-fg">Sign in to your account</h2>
          <LoginForm next={typeof next === "string" ? next : ""} />
        </div>
      </div>
    </main>
  );
}
