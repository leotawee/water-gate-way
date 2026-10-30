/** A numeric reading: null -> "—"; 0 is a real value and renders as 0.000 (fixes B2). */
export default function Reading({
  value,
  digits,
  unit,
  color = "text-gray-700",
}: {
  value: number | null;
  digits: number;
  unit: string;
  color?: string;
}) {
  return (
    <div className="text-right">
      <div className={`text-2xl font-extrabold font-mono ${color}`}>
        {value === null ? "—" : value.toFixed(digits)}
      </div>
      <div className="text-[10px] text-gray-400 font-medium">{unit}</div>
    </div>
  );
}
