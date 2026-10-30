import { Activity } from "lucide-react";

export default function LiveIcon({ live }: { live: boolean }) {
  return <Activity className={`w-4 h-4 ${live ? "text-green-500" : "text-gray-300"}`} />;
}
