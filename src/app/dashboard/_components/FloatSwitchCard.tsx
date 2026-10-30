import { Waves } from "lucide-react";
import LiveIcon from "./LiveIcon";

const ROWS = [
  { key: "f1", label: "F1 — Upper" },
  { key: "f2", label: "F2 — Lower" },
  { key: "f3", label: "F3" },
];

export default function FloatSwitchCard({ float, live }: { float: Record<string, boolean> | null; live: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Waves className="w-5 h-5 text-indigo-500" />
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">Float Switch</h3>
        </div>
        <LiveIcon live={live} />
      </div>

      <div className="space-y-3">
        {ROWS.map(({ key, label }) => {
          // WHY: a missing key means the payload did not report it; show "—", not OFF.
          const on = float?.[key];
          return (
            <div key={key} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <span className="text-sm font-semibold text-gray-700">{label}</span>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${on ? "bg-green-500" : "bg-gray-300"}`} />
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    on ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {on === undefined ? "—" : on ? "ON" : "OFF"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
