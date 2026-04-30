"use client";

import { useState } from "react";
import WebRTCPlayer from "@/components/WebRTCPlayer";
import WebRTCMQTTPlayer from "@/components/WebRTCMQTTPlayer";

export default function TestWebRTCPage() {
  const [signalingType, setSignalingType] = useState<"http" | "mqtt">("mqtt");

  const [httpConfig, setHttpConfig] = useState({
    signalingUrl: "http://192.168.1.100:8000/stream",
    stunServer: "stun:stun.l.google.com:19302",
    camId: 1,
  });

  const [mqttConfig, setMqttConfig] = useState({
    mqttUrl: "ws://192.168.1.100:8083",
    uid: "water-gate-cam-1",
    mqttUsername: "hakunamatata",
    mqttPassword: "Wonderful",
    camId: 1,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <span className="text-4xl">🧪</span>
                WebRTC Test Page
              </h1>
              <p className="text-purple-100 mt-1">
                Ultra-low latency video streaming from Raspberry Pi 4
              </p>
            </div>
            <a
              href="/"
              className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition-colors"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Signaling Type Selector */}
        <div className="mb-6 bg-gray-800 rounded-2xl p-4 border border-gray-700">
          <div className="flex items-center gap-4">
            <span className="text-sm font-bold text-gray-300">Signaling Type:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSignalingType("mqtt")}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  signalingType === "mqtt"
                    ? "bg-purple-500 text-white shadow-lg shadow-purple-500/25"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                MQTT (RaspberryPi-WebRTC)
              </button>
              <button
                onClick={() => setSignalingType("http")}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  signalingType === "http"
                    ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                HTTP POST (Custom)
              </button>
            </div>
          </div>
        </div>

        {/* Configuration Panel */}
        <div className="mb-8 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⚙️</span>
            Connection Configuration
          </h2>

          {signalingType === "mqtt" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MQTT URL */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-purple-400">
                  MQTT Broker URL
                </label>
                <input
                  type="text"
                  value={mqttConfig.mqttUrl}
                  onChange={(e) =>
                    setMqttConfig({ ...mqttConfig, mqttUrl: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  placeholder="ws://192.168.x.x:8083"
                />
                <p className="text-xs text-gray-400">
                  WebSocket URL to MQTT broker (ws:// or wss://)
                </p>
              </div>

              {/* UID */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-purple-400">
                  Camera UID
                </label>
                <input
                  type="text"
                  value={mqttConfig.uid}
                  onChange={(e) =>
                    setMqttConfig({ ...mqttConfig, uid: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  placeholder="water-gate-cam-1"
                />
                <p className="text-xs text-gray-400">
                  Must match Pi's --uid parameter
                </p>
              </div>

              {/* MQTT Username */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-purple-400">
                  MQTT Username (Optional)
                </label>
                <input
                  type="text"
                  value={mqttConfig.mqttUsername}
                  onChange={(e) =>
                    setMqttConfig({ ...mqttConfig, mqttUsername: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  placeholder="hakunamatata"
                />
                <p className="text-xs text-gray-400">
                  Leave empty if no authentication
                </p>
              </div>

              {/* MQTT Password */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-purple-400">
                  MQTT Password (Optional)
                </label>
                <input
                  type="password"
                  value={mqttConfig.mqttPassword}
                  onChange={(e) =>
                    setMqttConfig({ ...mqttConfig, mqttPassword: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                  placeholder="Wonderful"
                />
                <p className="text-xs text-gray-400">
                  Leave empty if no authentication
                </p>
              </div>

              {/* Camera ID */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-purple-400">
                  Camera ID
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={mqttConfig.camId}
                  onChange={(e) =>
                    setMqttConfig({ ...mqttConfig, camId: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-400">Display identifier</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Signaling URL */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-emerald-400">
                  Signaling URL
                </label>
                <input
                  type="text"
                  value={httpConfig.signalingUrl}
                  onChange={(e) =>
                    setHttpConfig({ ...httpConfig, signalingUrl: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
                  placeholder="http://192.168.x.x:8000/stream"
                />
                <p className="text-xs text-gray-400">
                  Backend HTTP endpoint for SDP exchange
                </p>
              </div>

              {/* STUN Server */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-emerald-400">
                  STUN Server
                </label>
                <input
                  type="text"
                  value={httpConfig.stunServer}
                  onChange={(e) =>
                    setHttpConfig({ ...httpConfig, stunServer: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
                  placeholder="stun:stun.l.google.com:19302"
                />
                <p className="text-xs text-gray-400">NAT traversal server</p>
              </div>

              {/* Camera ID */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-emerald-400">
                  Camera ID
                </label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={httpConfig.camId}
                  onChange={(e) =>
                    setHttpConfig({ ...httpConfig, camId: parseInt(e.target.value) || 1 })
                  }
                  className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-400">Display identifier</p>
              </div>
            </div>
          )}

          {/* Reset Button */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={() => {
                if (signalingType === "mqtt") {
                  setMqttConfig({
                    mqttUrl: "ws://192.168.1.100:8083",
                    uid: "water-gate-cam-1",
                    mqttUsername: "hakunamatata",
                    mqttPassword: "Wonderful",
                    camId: 1,
                  });
                } else {
                  setHttpConfig({
                    signalingUrl: "http://192.168.1.100:8000/stream",
                    stunServer: "stun:stun.l.google.com:19302",
                    camId: 1,
                  });
                }
              }}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-sm transition-colors"
            >
              Reset to Defaults
            </button>
            <button
              onClick={() => {
                const config = signalingType === "mqtt" ? mqttConfig : httpConfig;
                navigator.clipboard.writeText(JSON.stringify(config, null, 2));
                alert("Configuration copied to clipboard!");
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold text-sm transition-colors"
            >
              Copy Config
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📹</span>
            WebRTC Video Stream
            <span className="text-sm font-normal text-gray-400">
              ({signalingType === "mqtt" ? "MQTT Signaling" : "HTTP POST Signaling"})
            </span>
          </h2>

          <div className={`aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 ${
            signalingType === "mqtt" ? "border-purple-500" : "border-emerald-500"
          }`}>
            {signalingType === "mqtt" ? (
              <WebRTCMQTTPlayer
                mqttUrl={mqttConfig.mqttUrl}
                uid={mqttConfig.uid}
                mqttUsername={mqttConfig.mqttUsername}
                mqttPassword={mqttConfig.mqttPassword}
                camId={mqttConfig.camId}
              />
            ) : (
              <WebRTCPlayer
                signalingUrl={httpConfig.signalingUrl}
                stunServer={httpConfig.stunServer}
                camId={httpConfig.camId}
              />
            )}
          </div>
        </div>

        {/* Debug Instructions */}
        <div className="mt-8 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🔍</span>
            Debug Checklist
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Browser Console */}
            <div>
              <h3 className="font-bold text-purple-400 mb-2">
                1. Open Browser Console (F12)
              </h3>
              <p className="text-sm text-gray-300 mb-2">
                Look for these logs:
              </p>
              <ul className="text-xs text-gray-400 space-y-1 font-mono bg-gray-900 p-3 rounded-lg">
                <li>🎥 Camera X: Initializing MQTT WebRTC...</li>
                <li>📡 MQTT Broker: ws://192.168.x.x:8083</li>
                <li>🏷️  UID: water-gate-cam-1</li>
                <li>✅ Camera X: MQTT Connected</li>
                <li>🧊 ICE State → checking/connected</li>
                <li>📹 Camera X: Received video track</li>
              </ul>
            </div>

            {/* Raspberry Pi Setup */}
            <div>
              <h3 className="font-bold text-purple-400 mb-2">
                2. Raspberry Pi Command
              </h3>
              <p className="text-sm text-gray-300 mb-2">
                Run on Pi (TzuHuanTai/RaspberryPi-WebRTC):
              </p>
              <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded-lg overflow-x-auto">
{`./pi-webrtc \\
  --camera=libcamera:0 \\
  --fps=30 \\
  --width=1280 \\
  --height=960 \\
  --use-mqtt \\
  --mqtt-host={mqttConfig.mqttUrl.replace("ws://", "").replace(":8083", "")} \\
  --mqtt-port=1883 \\
  --mqtt-username={mqttConfig.mqttUsername || "(none)"} \\
  --mqtt-password={mqttConfig.mqttPassword || "(none)"} \\
  --uid={mqttConfig.uid} \\
  --no-audio \\
  --hw-accel`}
              </pre>
            </div>

            {/* MQTT Broker Setup */}
            <div>
              <h3 className="font-bold text-purple-400 mb-2">
                3. MQTT Broker Setup
              </h3>
              <p className="text-sm text-gray-300 mb-2">
                Install Mosquitto on Raspberry Pi:
              </p>
              <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded-lg overflow-x-auto">
{`sudo apt update
sudo apt install mosquitto mosquitto-clients

# Configure /etc/mosquitto/mosquitto.conf:
listener 1883
allow_anonymous true

# Restart:
sudo systemctl restart mosquitto`}
              </pre>
            </div>

            {/* Common Issues */}
            <div>
              <h3 className="font-bold text-purple-400 mb-2">
                4. Common Issues
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>❌ <strong>MQTT connection failed</strong> → Check broker URL and port</li>
                <li>❌ <strong>ICE failed</strong> → Check network and STUN server</li>
                <li>❌ <strong>No video</strong> → Check camera hardware on Pi</li>
                <li>❌ <strong>Authentication failed</strong> → Verify username/password</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Current Config Display */}
        <div className="mt-8 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📋</span>
            Current Configuration
          </h2>
          <pre className="text-sm text-purple-400 bg-gray-900 p-4 rounded-lg overflow-x-auto font-mono">
{JSON.stringify(signalingType === "mqtt" ? mqttConfig : httpConfig, null, 2)}
          </pre>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-gray-800 border-t border-gray-700 py-6 text-center">
        <p className="text-sm text-gray-400">
          WebRTC Test Page — Water Gate Way System © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
