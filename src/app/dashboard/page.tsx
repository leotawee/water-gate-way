import { notFound } from "next/navigation";
import { requirePageUser } from "@/lib/auth/dal";
import { getGate } from "@/lib/gatesDb";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { gate: raw } = await searchParams;
  const id = raw === undefined ? "gate-1" : typeof raw === "string" ? raw : undefined;
  const next = "/dashboard" + (typeof raw === "string" ? `?gate=${encodeURIComponent(raw)}` : "");

  // WHY: auth before the gate lookup, so a logged-out visitor always lands on /login.
  const user = await requirePageUser(next);
  // WHY: getGate returns active gates only, so an inactive gate 404s like a missing one.
  const gate = await getGate(id);
  if (!gate) notFound();

  return <DashboardClient gate={gate} role={user.role} />;
}
