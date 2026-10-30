import { ScanLine } from "lucide-react";

export default function DetectionCard({ personCount }: { personCount: number | null }) {
  const seen = personCount !== null && personCount > 0;
  return (
    <div
      className={`rounded-2xl border-2 p-5 text-center transition-all duration-300 ${
        seen ? "bg-orange-50 border-orange-200 shadow-md shadow-orange-500/10" : "bg-green-50 border-green-200"
      }`}
    >
      <ScanLine className={`w-8 h-8 mx-auto mb-2 ${seen ? "text-orange-500" : "text-green-500"}`} />
      <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-1">AI Detection</h3>
      <div className={`text-3xl font-extrabold ${seen ? "text-orange-600" : "text-green-600"}`}>
        {personCount === null ? "—" : seen ? "เจอคน" : "ไม่มีคน"}
      </div>
      {seen && (
        <div className="text-xs text-orange-500 mt-1 animate-pulse font-medium">Person detected! ({personCount})</div>
      )}
      <div className="mt-2 text-[10px] text-gray-400">Mode: {personCount === null ? "—" : seen ? "M1" : "M0"}</div>
    </div>
  );
}
