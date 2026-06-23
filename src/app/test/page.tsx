"use client";

import { useMqtt } from "@/hooks/useMqtt";

export default function TestPage() {
  const { publish, connected, connState } = useMqtt();

  const handleSendP1 = () => {
    publish("P1");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4 text-black">MQTT Test Page</h1>
      
      <div className="mb-6 p-4 bg-white rounded shadow text-black">
        <p>
          <span className="font-semibold">MQTT Status:</span>{" "}
          <span className={connected ? "text-green-600" : "text-red-600"}>
            {connState} {connected ? "🟢" : "🔴"}
          </span>
        </p>
      </div>
      
      <button
        onClick={handleSendP1}
        disabled={!connected}
        className="px-8 py-4 bg-blue-500 text-white font-bold rounded-lg shadow-md hover:bg-blue-600 transition-colors focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-50 disabled:cursor-not-allowed text-xl"
      >
        ส่งคำสั่งเปิดปั๊ม (P1)
      </button>
    </div>
  );
}
