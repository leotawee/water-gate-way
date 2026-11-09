import type { LucideIcon } from "lucide-react";

/** A card or panel title with its icon. The icon is decoration only (muted, one stroke weight) and hidden from assistive tech. */
export default function CardTitle({
  id,
  icon: Icon,
  as: Tag = "h3",
  className = "text-sm",
  children,
}: {
  id?: string;
  icon: LucideIcon;
  as?: "h1" | "h2" | "h3";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag id={id} className={`flex items-center gap-2 font-bold text-fg ${className}`}>
      <Icon className="size-4 shrink-0 text-muted" strokeWidth={1.75} aria-hidden="true" />
      {children}
    </Tag>
  );
}
