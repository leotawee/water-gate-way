"use client";

import { useEffect, useRef, useState } from "react";
import mqtt, { MqttClient } from "mqtt";

/**
 * MQTT Broker Camera Component
 *
 * Receives Base64 JPEG images via MQTT from Raspberry Pi.
 * Ultra-simple, reliable, compatible with any hardware.
 *
 * Architecture:
 * Tapo C310 → Python Script → MQTT Broker → Next.js Dashboard
 *
 * @component
 * @example
 * ```tsx
 * <MQTTBrokerCamera
 *   brokerUrl="mqtt://178.128.49.254:1883"
 *   topic="gate/camera/stream"
 * />
 * ```
 */

interface MQTTBrokerCameraProps {
  /** MQTT Broker URL (mqtt:// or ws://) */
  brokerUrl?: string;
  /** MQTT Topic to subscribe */
  topic?: string;
  /** Camera identifier for display */
  camId?: number;
}

export default function MQTTBrokerCamera({
  brokerUrl = "mqtt://178.128.49.254:1883",
  topic = "gate/camera/stream",
  camId = 1,
}: MQTTBrokerCameraProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mqttClientRef = useRef<MqttClient | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>("");
  const [fps, setFps] = useState(0);
  const [frameCount, setFrameCount] = useState(0);

  // FPS calculation
  const lastFrameTime = useRef<number>(Date.now());
  const frameCountRef = useRef<number>(0);

  useEffect(() => {
    console.log(`📹 Camera ${camId}: Connecting to MQTT Broker...`);
    console.log(`🌐 Broker: ${brokerUrl}`);
    console.log(`📡 Topic: ${topic}`);

    let client: MqttClient | null = null;
    let isMounted = true;
    let fpsInterval: NodeJS.Timeout;

    /**
     * CONNECT TO MQTT BROKER
     */
    const connectMQTT = () => {
      try {
        // Connect to MQTT broker
        client = mqtt.connect(brokerUrl, {
          clientId: `water-gate-dashboard-${camId}-${Math.random().toString(16).substr(2, 8)}`,
          clean: true,
          connectTimeout: 30 * 1000,
          reconnectPeriod: 5 * 1000,
        });

        mqttClientRef.current = client;

        // Event: Connected
        client.on("connect", () => {
          console.log(`✅ Camera ${camId}: MQTT Connected to ${brokerUrl}`);

          if (isMounted) {
            setIsConnected(true);
            setError("");
          }

          // Subscribe to camera topic
          client!.subscribe(topic, { qos: 0 }, (err) => {
            if (err) {
              console.error(`❌ Camera ${camId}: Subscribe failed`, err);
              if (isMounted) {
                setError(`Subscribe failed: ${err.message}`);
              }
            } else {
              console.log(`📥 Camera ${camId}: Subscribed to ${topic}`);
            }
          });
        });

        // Event: Message received
        client.on("message", (receivedTopic, message) => {
          if (!isMounted || receivedTopic !== topic) return;

          try {
            // Decode Base64 to image
            const base64String = message.toString();
            const imgData = `data:image/jpeg;base64,${base64String}`;

            // Render to canvas
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext("2d");
              if (!ctx) return;

              const img = new Image();
              img.onload = () => {
                if (canvasRef.current) {
                  ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                  ctx.drawImage(img, 0, 0, canvasRef.current.width, canvasRef.current.height);
                }

                // Calculate FPS
                frameCountRef.current++;
                const now = Date.now();
                const elapsed = now - lastFrameTime.current;

                if (elapsed >= 1000) {
                  setFps(Math.round((frameCountRef.current * 1000) / elapsed));
                  frameCountRef.current = 0;
                  lastFrameTime.current = now;
                }
              };

              img.onerror = () => {
                console.error(`❌ Camera ${camId}: Failed to load image`);
              };

              img.src = imgData;
            }

            setFrameCount((prev) => prev + 1);
          } catch (err) {
            console.error(`❌ Camera ${camId}: Failed to process image`, err);
          }
        });

        // Event: Error
        client.on("error", (err) => {
          console.error(`❌ Camera ${camId}: MQTT error`, err);
          if (isMounted) {
            setError(`MQTT error: ${err.message}`);
            setIsConnected(false);
          }
        });

        // Event: Reconnect
        client.on("reconnect", () => {
          console.log(`🔄 Camera ${camId}: MQTT reconnecting...`);
        });

        // Event: Close
        client.on("close", () => {
          console.log(`🔌 Camera ${camId}: MQTT connection closed`);
          if (isMounted) {
            setIsConnected(false);
          }
        });

        // FPS counter update
        fpsInterval = setInterval(() => {
          const now = Date.now();
          const elapsed = now - lastFrameTime.current;

          if (elapsed >= 1000) {
            setFps(Math.round((frameCountRef.current * 1000) / elapsed));
            frameCountRef.current = 0;
            lastFrameTime.current = now;
          }
        }, 1000);

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`❌ Camera ${camId}: Connection failed`, err);
        if (isMounted) {
          setError(errorMsg);
          setIsConnected(false);
        }
      }
    };

    connectMQTT();

    /**
     * CLEANUP: Disconnect MQTT on unmount
     */
    return () => {
      console.log(`🔌 Camera ${camId}: Cleaning up MQTT connection...`);
      isMounted = false;

      if (fpsInterval) {
        clearInterval(fpsInterval);
      }

      if (mqttClientRef.current) {
        mqttClientRef.current.end();
        mqttClientRef.current = null;
      }

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
    };
  }, [camId, brokerUrl, topic]);

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-green-400 shadow-lg">
      {/* Canvas for rendering */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-full object-contain"
      />

      {/* Connection Status */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
        <span className="text-[10px] font-bold text-white uppercase tracking-tighter">
          {isConnected ? "MQTT CONNECTED" : "CONNECTING..."}
        </span>
      </div>

      {/* Camera Label */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-green-400/30">
        <span className="text-white text-xs font-bold">CAM {camId} (MQTT)</span>
      </div>

      {/* FPS Counter */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
        </span>
        <span className="text-[10px] font-bold text-green-500 uppercase tracking-tighter">
          {fps} FPS
        </span>
      </div>

      {/* Frame Counter */}
      <div className="absolute bottom-16 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
        <span className="text-[10px] text-gray-300 font-mono">
          Frames: {frameCount}
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-3 right-3 bg-red-500/90 backdrop-blur-sm px-3 py-1.5 rounded-lg max-w-xs">
          <p className="text-white text-xs font-bold">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {!isConnected && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-green-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-green-400 font-semibold">
              Connecting to MQTT Broker...
            </p>
            <p className="text-xs text-gray-400">
              {brokerUrl}
            </p>
            <p className="text-xs text-gray-400">
              Topic: {topic}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
