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
    <span className={`text-base font-bold tabular-nums ${color}`}>
      {value === null ? "—" : value.toFixed(digits)}
      {value !== null && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
    </span>
  );
}
