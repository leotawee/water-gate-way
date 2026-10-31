/** A numeric reading: null -> "—"; 0 is a real value and renders as 0.000 (fixes B2). */
export default function Reading({
  value,
  digits,
  unit,
  color = "text-fg",
}: {
  value: number | null;
  digits: number;
  unit: string;
  color?: string;
}) {
  return (
    <div className="text-right">
      <div className={`font-mono text-2xl font-semibold tabular-nums ${color}`}>
        {value === null ? "—" : value.toFixed(digits)}
      </div>
      <div className="text-[11px] font-medium text-muted">{unit}</div>
    </div>
  );
}
