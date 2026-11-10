import { Badge } from "@/components/ui/badge";

/** One state word with its dot: colour never carries the meaning alone.
 *  Renders the shadcn Badge with the state tone; `unknown` keeps the dashed hollow form
 *  (WHY: replaces the diagonal hatch, which tiled across every stale row and read as texture). */
export type PillTone = "on" | "off" | "warn" | "danger" | "unknown";

const TONE: Record<Exclude<PillTone, "unknown">, { pill: string; dot: string }> = {
  on: { pill: "bg-on-soft text-on", dot: "bg-on" },
  off: { pill: "bg-off-soft text-off", dot: "bg-off" },
  warn: { pill: "bg-warn-soft text-warn", dot: "bg-warn" },
  danger: { pill: "bg-danger-soft text-danger", dot: "bg-danger" },
};

export default function StatePill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  if (tone === "unknown") {
    return (
      <Badge className="border border-dashed border-unknown bg-surface text-muted">
        <span className="size-2 shrink-0 rounded-full border-[1.5px] border-unknown" aria-hidden="true" />
        {children}
      </Badge>
    );
  }
  return (
    <Badge className={TONE[tone].pill}>
      <span className={`size-2 shrink-0 rounded-full ${TONE[tone].dot}`} aria-hidden="true" />
      {children}
    </Badge>
  );
}
