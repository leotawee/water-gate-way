import { Zap } from "lucide-react";
import type { GateStatus } from "@/lib/telemetry/parseStatus";
import Reading from "./Reading";
import LiveIcon from "./LiveIcon";

export default function ElectricCard({ pzem, live }: { pzem: GateStatus["pzem"] | null; live: boolean }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider">PZEM — Electric</h3>
        </div>
        <LiveIcon live={live} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-50 border border-yellow-100">
          <span className="text-sm font-semibold text-gray-600">Voltage</span>
          <Reading value={pzem?.voltage ?? null} digits={1} unit="Volts" color="text-yellow-600" />
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-100">
          <span className="text-sm font-semibold text-gray-600">Current</span>
          <Reading value={pzem?.current ?? null} digits={2} unit="Amps" color="text-orange-600" />
        </div>
        <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 border border-blue-100">
          <span className="text-sm font-semibold text-gray-600">Frequency</span>
          <Reading value={pzem?.frequency ?? null} digits={2} unit="Hz" color="text-blue-600" />
        </div>
      </div>
    </div>
  );
}
