import type { Metadata } from "next";
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
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Water Gate Way</h1>
      <div className="w-full max-w-md bg-white rounded-xl shadow-md p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>
        <LoginForm next={typeof next === "string" ? next : ""} />
      </div>
    </main>
  );
}
