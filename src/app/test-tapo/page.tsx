"use client";

import { useState } from "react";
import RTSPWebRTCPlayer from "@/components/RTSPWebRTCPlayer";

export default function TestTapoPage() {
  const [config, setConfig] = useState({
    rtspUrl: "rtsp://admin:password@192.168.1.150/stream1",
    signalingUrl: "http://192.168.1.151:8000/stream",
    camId: 1,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-cyan-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <span className="text-4xl">📹</span>
                Tapo C310 Test Page
              </h1>
              <p className="text-blue-100 mt-1">
                RTSP to WebRTC ultra-low latency streaming
              </p>
            </div>
            <a href=""className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-semibold transition-colors">
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Configuration Panel */}
        <div className="mb-8 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⚙️</span>
            Tapo C310 Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* RTSP URL */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-blue-400">
                RTSP URL
              </label>
              <input
                type="text"
                value={config.rtspUrl}
                onChange={(e) =>
                  setConfig({ ...config, rtspUrl: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="rtsp://username:password@192.168.1.150/stream1"
              />
              <p className="text-xs text-gray-400">
                Tapo C310 RTSP stream URL (format: rtsp://user:pass@ip/stream)
              </p>
            </div>

            {/* Signaling URL */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-blue-400">
                Pi Signaling URL (pi-webrtc)
              </label>
              <input
                type="text"
                value={config.signalingUrl}
                onChange={(e) =>
                  setConfig({ ...config, signalingUrl: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="http://192.168.1.151:8000/stream"
              />
              <p className="text-xs text-gray-400">
                Raspberry Pi pi-webrtc HTTP endpoint (192.168.1.151:8000)
              </p>
            </div>

            {/* Camera ID */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-blue-400">
                Camera ID
              </label>
              <input
                type="number"
                min="1"
                max="99"
                value={config.camId}
                onChange={(e) =>
                  setConfig({ ...config, camId: parseInt(e.target.value) || 1 })
                }
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              />
              <p className="text-xs text-gray-400">Display identifier</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={() =>
                setConfig({
                  rtspUrl: "rtsp://admin:password@192.168.1.150/stream1",
                  signalingUrl: "http://192.168.1.151:8000/stream",
                  camId: 1,
                })
              }
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold text-sm transition-colors"
            >
              Reset to Defaults
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(config, null, 2));
                alert("Configuration copied to clipboard!");
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-sm transition-colors"
            >
              Copy Config
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📹</span>
            Tapo C310 Video Stream
          </h2>

          <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-blue-500">
            <RTSPWebRTCPlayer
              signalingUrl={config.signalingUrl}
              rtspUrl={config.rtspUrl}
              camId={config.camId}
            />
          </div>
        </div>

        {/* Setup Instructions */}
        <div className="mt-8 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🔧</span>
            Tapo C310 Setup Instructions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Enable RTSP on Tapo C310 */}
            <div>
              <h3 className="font-bold text-blue-400 mb-2">
                1. Enable RTSP on Tapo C310
              </h3>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Open Tapo app on your phone</li>
                <li>Go to Camera Settings → Advanced Settings</li>
                <li>Enable "RTSP" </li>
                <li>Set username and password</li>
                <li>Save and note down the RTSP URL</li>
              </ol>
            </div>

            {/* Step 2: Get RTSP URL */}
            <div>
              <h3 className="font-bold text-blue-400 mb-2">
                2. Get RTSP URL
              </h3>
              <p className="text-sm text-gray-300 mb-2">
                RTSP URL format:
              </p>
              <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded-lg overflow-x-auto">
{`rtsp://USERNAME:PASSWORD@192.168.1.150/stream1

Where:
- USERNAME: Your Tapo camera username
- PASSWORD: Your Tapo camera password
- 192.168.1.150: Tapo camera IP address
- stream1: Main stream (higher quality)
- stream2: Sub stream (lower quality, faster)`}
              </pre>
            </div>

            {/* Step 3: Setup Raspberry Pi */}
            <div>
              <h3 className="font-bold text-blue-400 mb-2">
                3. Setup Raspberry Pi (pi-webrtc)
              </h3>
              <p className="text-sm text-gray-300 mb-2">
                <strong>Architecture:</strong> Tapo C310 → RTSP → Raspberry Pi (pi-webrtc) → WebRTC → Dashboard
              </p>
              <p className="text-xs text-gray-400 mb-2">
                Quick Steps:
              </p>
              <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                <li>Download pi-webrtc binary to Pi (192.168.1.151)</li>
                <li>Configure RTSP URL: rtsp://admin:password@192.168.1.150/stream1</li>
                <li>Run: ./pi-webrtc --camera=rtsp:RTSP_URL --use-http --http-port=8000</li>
                <li>Test on this page with Signaling URL: http://192.168.1.151:8000/stream</li>
              </ol>
            </div>

            {/* Step 4: Troubleshooting */}
            <div>
              <h3 className="font-bold text-blue-400 mb-2">
                4. Troubleshooting
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>❌ <strong>Connection failed</strong> → Check Pi is running: ping 192.168.1.151</li>
                <li>❌ <strong>No video</strong> → Verify pi-webrtc is running on port 8000</li>
                <li>❌ <strong>RTSP error</strong> → Test RTSP with VLC: rtsp://admin:password@192.168.1.150/stream1</li>
                <li>❌ <strong>High latency</strong> → Use wired Ethernet, reduce resolution</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="mt-8 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🏗️</span>
            System Architecture
          </h2>

          <div className="bg-gray-900 p-4 rounded-lg">
            <pre className="text-xs text-gray-400 font-mono text-center">
{`┌──────────────┐         RTSP          ┌─────────────┐        WebRTC        ┌──────────────┐
│              │ ──────────────────────> │             │ ─────────────────────> │              │
│  Tapo C310   │   rtsp://user:pass@IP   │  Raspberry  │   HTTP signaling      │   Browser    │
│   Camera     │                          │     Pi      │        + stream       │  Dashboard   │
│              │                          │ (pi-webrtc) │                        │              │
└──────────────┘                           └─────────────┘                        └──────────────┘
  192.168.1.150                              192.168.1.151

Latency: ~150-200ms (ultra-low)
Quality: 1280x960 @ 30fps`}
            </pre>
          </div>
        </div>

        {/* Current Config Display */}
        <div className="mt-8 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📋</span>
            Current Configuration
          </h2>
          <pre className="text-sm text-blue-400 bg-gray-900 p-4 rounded-lg overflow-x-auto font-mono">
{JSON.stringify(config, null, 2)}
          </pre>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-gray-800 border-t border-gray-700 py-6 text-center">
        <p className="text-sm text-gray-400">
          Tapo C310 Test Page — Water Gate Way System © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
