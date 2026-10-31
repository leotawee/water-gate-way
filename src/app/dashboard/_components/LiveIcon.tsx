import { Activity } from "lucide-react";

/** Live/offline state as icon + text (never colour alone). */
export default function LiveIcon({ live }: { live: boolean }) {
  return (
    <span
      className={`pill ${live ? "bg-ok/10 text-ok ring-ok/40" : "bg-surface-2 text-muted ring-border"}`}
    >
      <Activity className="size-3.5" aria-hidden="true" />
      {live ? "Live" : "Offline"}
    </span>
  );
}
