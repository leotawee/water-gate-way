"use client";

import { useState } from "react";
import MQTTBrokerCamera from "@/components/MQTTBrokerCamera";

export default function TestMQTTPage() {
  const [config, setConfig] = useState({
    brokerUrl: "mqtt://178.128.49.254:1883",
    topic: "gate/camera/stream",
    camId: 1,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <span className="text-4xl">📡</span>
                MQTT Bridge Camera Test
              </h1>
              <p className="text-green-100 mt-1">
                Reliable MQTT-based streaming from Raspberry Pi
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
        {/* Configuration Panel */}
        <div className="mb-8 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>⚙️</span>
            MQTT Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Broker URL */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-green-400">
                MQTT Broker URL
              </label>
              <input
                type="text"
                value={config.brokerUrl}
                onChange={(e) =>
                  setConfig({ ...config, brokerUrl: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                placeholder="mqtt://178.128.49.254:1883"
              />
              <p className="text-xs text-gray-400">
                Cloud MQTT broker (use mqtt:// or ws://)
              </p>
            </div>

            {/* Topic */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-green-400">
                MQTT Topic
              </label>
              <input
                type="text"
                value={config.topic}
                onChange={(e) =>
                  setConfig({ ...config, topic: e.target.value })
                }
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
                placeholder="gate/camera/stream"
              />
              <p className="text-xs text-gray-400">
                Topic to subscribe (must match Pi publisher)
              </p>
            </div>

            {/* Camera ID */}
            <div className="space-y-2">
              <label className="text-sm font-semibold text-green-400">
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
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm"
              />
              <p className="text-xs text-gray-400">Display identifier</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="mt-4 flex gap-3">
            <button
              onClick={() =>
                setConfig({
                  brokerUrl: "mqtt://178.128.49.254:1883",
                  topic: "gate/camera/stream",
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
              className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg font-semibold text-sm transition-colors"
            >
              Copy Config
            </button>
          </div>
        </div>

        {/* Video Player */}
        <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>📹</span>
            MQTT Video Stream
          </h2>

          <div className="aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-green-500">
            <MQTTBrokerCamera
              brokerUrl={config.brokerUrl}
              topic={config.topic}
              camId={config.camId}
            />
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
{`┌──────────────┐      RTSP       ┌─────────────┐      Publish      ┌──────────────┐
│              │ ─────────────────> │             │ ──────────────────> │              │
│  Tapo C310   │   rtsp://user:pass  │  Raspberry  │   Base64 JPEG      │   MQTT       │
│   Camera     │                     │     Pi      │                     │   Broker     │
│              │                     │  (Python)   │                     │  178.128.49. │
└──────────────┘                     └─────────────┘                     └──────────────┘
                                                                          │
                                                                          │ Subscribe
                                                                          ▼
                                                                    ┌──────────────┐
                                                                    │              │
                                                                    │   Browser    │
                                                                    │  Dashboard   │
                                                                    │              │
                                                                    └──────────────┘

Latency: ~200-500ms (depends on network)
Quality: 1280x720 @ 15-30fps`}
            </pre>
          </div>
        </div>

        {/* Hardware Team Instructions */}
        <div className="mt-8 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🔧</span>
            Hardware Team Instructions (Python Script)
          </h2>

          <div className="space-y-6">
            {/* Step 1: Install Python Dependencies */}
            <div>
              <h3 className="font-bold text-green-400 mb-2">
                1. Install Python Dependencies on Pi
              </h3>
              <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded-lg overflow-x-auto">
{`# SSH into Raspberry Pi
ssh pi@192.168.1.151

# Install required packages
sudo apt update
sudo apt install -y python3-pip python3-opencv

# Install MQTT library
pip3 install paho-mqtt`}
              </pre>
            </div>

            {/* Step 2: Python Script */}
            <div>
              <h3 className="font-bold text-green-400 mb-2">
                2. Create Python Script (camera_publisher.py)
              </h3>
              <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded-lg overflow-x-auto">
{`import cv2
import paho.mqtt.client as mqtt
import base64

# Configuration
RTSP_URL = "rtsp://admin:YOUR_PASSWORD@192.168.1.150/stream1"
MQTT_BROKER = "178.128.49.254"
MQTT_PORT = 1883
MQTT_TOPIC = "gate/camera/stream"

# Connect to MQTT
client = mqtt.Client()
client.connect(MQTT_BROKER, MQTT_PORT, 60)

# Open RTSP stream
cap = cv2.VideoCapture(RTSP_URL)

print("📹 Publishing frames to MQTT...")

while True:
    ret, frame = cap.read()
    if not ret:
        break

    # Encode as JPEG
    _, buffer = cv2.imencode('.jpg', frame)
    jpg_as_text = base64.b64encode(buffer).decode('utf-8')

    # Publish to MQTT
    client.publish(MQTT_TOPIC, jpg_as_text)

    # Display FPS
    cv2.imshow('Publishing...', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
client.disconnect()
cv2.destroyAllWindows()`}
              </pre>
            </div>

            {/* Step 3: Run Script */}
            <div>
              <h3 className="font-bold text-green-400 mb-2">
                3. Run Script on Pi
              </h3>
              <pre className="text-xs text-gray-400 bg-gray-900 p-3 rounded-lg overflow-x-auto">
{`# On Raspberry Pi
python3 camera_publisher.py

# Expected output:
# 📹 Publishing frames to MQTT...
# Frames will be sent to 178.128.49.254:1883
# Topic: gate/camera/stream`}
              </pre>
            </div>

            {/* Step 4: Test Connection */}
            <div>
              <h3 className="font-bold text-green-400 mb-2">
                4. Test Connection from Dashboard
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>✅ Open this page: http://localhost:3000/test-mqtt</li>
                <li>✅ Verify Broker URL: mqtt://178.128.49.254:1883</li>
                <li>✅ Verify Topic: gate/camera/stream</li>
                <li>✅ Run Python script on Pi</li>
                <li>✅ Video should appear within ~1 second</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Troubleshooting */}
        <div className="mt-8 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>🔍</span>
            Troubleshooting
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* No Connection */}
            <div>
              <h3 className="font-bold text-green-400 mb-2">
                MQTT Not Connected
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>❌ Check broker URL is correct</li>
                <li>❌ Verify broker is reachable: ping 178.128.49.254</li>
                <li>❌ Check firewall allows port 1883</li>
                <li>❌ Verify broker credentials (if needed)</li>
              </ul>
            </div>

            {/* No Video */}
            <div>
              <h3 className="font-bold text-green-400 mb-2">
                No Video Stream
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>❌ Check Python script is running on Pi</li>
                <li>❌ Verify RTSP URL is correct</li>
                <li>❌ Test RTSP with VLC first</li>
                <li>❌ Check topic matches (gate/camera/stream)</li>
              </ul>
            </div>

            {/* Low FPS */}
            <div>
              <h3 className="font-bold text-green-400 mb-2">
                Low FPS / Lag
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>❌ Use wired Ethernet instead of WiFi</li>
                <li>❌ Reduce JPEG quality in Python script</li>
                <li>❌ Lower resolution (640x480 instead of 1280x720)</li>
                <li>❌ Check broker network capacity</li>
              </ul>
            </div>

            {/* Connection Drops */}
            <div>
              <h3 className="font-bold text-green-400 mb-2">
                Connection Drops
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>❌ Check internet connection stability</li>
                <li>❌ Verify broker uptime</li>
                <li>❌ Add error handling in Python script</li>
                <li>❌ Use QoS 1 for message reliability</li>
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
          <pre className="text-sm text-green-400 bg-gray-900 p-4 rounded-lg overflow-x-auto font-mono">
{JSON.stringify(config, null, 2)}
          </pre>
        </div>

        {/* Ready Message */}
        <div className="mt-8 bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-xl font-bold mb-2 flex items-center gap-2 text-white">
            <span>✅</span>
            Ready for Testing!
          </h2>
          <p className="text-green-100">
            Dashboard is ready to receive MQTT messages. Hardware Team can start sending images to <code className="bg-white/20 px-2 py-0.5 rounded">gate/camera/stream</code> topic now!
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-gray-800 border-t border-gray-700 py-6 text-center">
        <p className="text-sm text-gray-400">
          MQTT Bridge Test Page — Water Gate Way System © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
