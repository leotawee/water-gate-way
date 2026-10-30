import type { GateStatus } from "@/lib/telemetry/parseStatus";

const WIRES = [
  { key: "red", label: "Red (WB1)", bar: "bg-red-500" },
  { key: "blue", label: "Blue (WB2)", bar: "bg-blue-500" },
] as const;

export default function WireBreakCard({ wireBreak, live }: { wireBreak: GateStatus["wireBreak"] | null; live: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Wire Break</h3>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${live ? "bg-green-500" : "bg-gray-300"}`} />
          <span className="text-[10px] font-bold text-gray-400 uppercase">{live ? "Live" : "Offline"}</span>
        </div>
      </div>

      <div className="space-y-3">
        {WIRES.map(({ key, label, bar }) => {
          const broken = wireBreak?.[key] ?? null;
          return (
            <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-1 h-8 rounded-full ${bar}`} />
                <span className="text-sm font-semibold text-gray-700">{label}</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    broken === null ? "bg-gray-300" : broken ? "bg-red-500 animate-pulse" : "bg-green-500"
                  }`}
                />
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    broken === null
                      ? "bg-gray-100 text-gray-400"
                      : broken
                        ? "bg-red-100 text-red-600"
                        : "bg-green-100 text-green-600"
                  }`}
                >
                  {broken === null ? "—" : broken ? "BROKEN" : "NORMAL"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
