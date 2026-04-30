"use client";

/**
 * @deprecated
 *
 * ⚠️ This component is NO LONGER MAINTAINED.
 *
 * Please use `RTSPWebRTCPlayer.tsx` instead for all camera streaming.
 *
 * Architecture comparison:
 * - OLD: MQTTCameraStream.tsx → WebSocket → Base64 frames → Canvas (slow, unreliable)
 * - NEW: RTSPWebRTCPlayer.tsx → WebRTC → Direct video stream (fast, reliable)
 *
 * Migration guide:
 * 1. Replace `<MQTTCameraStream>` with `<RTSPWebRTCPlayer>`
 * 2. Remove WebSocket-related dependencies
 * 3. Configure RTSP URL and Pi signaling URL
 *
 * @deprecated Since April 2025 - Use RTSPWebRTCPlayer.tsx
 */

import { useEffect, useRef, useState } from "react";

interface MQTTCameraStreamProps {
  camId?: number;
  socketUrl?: string;
}

export default function MQTTCameraStream({
  camId = 1,
  socketUrl = "ws://localhost:1880/ws/camera1",
}: MQTTCameraStreamProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    console.log(`🎥 Camera ${camId}: Connecting to WebSocket ${socketUrl}...`);

    // Create WebSocket connection
    const ws = new WebSocket(socketUrl);
    wsRef.current = ws;

    // Connection opened
    ws.onopen = () => {
      console.log(`✅ Camera ${camId}: WebSocket Connected`);
      setIsConnected(true);
      setError("");
    };

    // Listen for messages
    ws.onmessage = (event) => {
      if (canvasRef.current) {
        try {
          const base64Data = event.data;

          // Handle both raw base64 and JSON-wrapped data
          let imageData = base64Data;
          if (base64Data.startsWith("{")) {
            const json = JSON.parse(base64Data);
            imageData = json.image || json.data || json.base64;
          }

          // Remove data URL prefix if present
          const base64String = imageData.replace(/^data:image\/[a-z]+;base64,/, "");

          // Create image from base64
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Clear and draw new frame
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            console.log(`📸 Camera ${camId}: Frame rendered (${base64String.length} bytes)`);
          };

          img.onerror = () => {
            console.error(`❌ Camera ${camId}: Failed to load image`);
          };

          img.src = `data:image/jpeg;base64,${base64String}`;
        } catch (err) {
          console.error(`❌ Camera ${camId}: Error processing message`, err);
          setError("Failed to process image");
        }
      }
    };

    // Connection closed
    ws.onclose = () => {
      console.log(`🔌 Camera ${camId}: WebSocket Disconnected`);
      setIsConnected(false);
    };

    // Connection error
    ws.onerror = (event) => {
      console.error(`❌ Camera ${camId}: WebSocket Error`, event);
      setError("WebSocket connection failed");
      setIsConnected(false);
    };

    // Cleanup on unmount
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [camId, socketUrl]);

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-yellow-400 shadow-lg">
      {/* Canvas for rendering */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className="w-full h-full object-contain"
      />

      {/* Connection Status Indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
        <span className="text-[10px] font-bold text-white uppercase tracking-tighter">
          {isConnected ? "CONNECTED" : "DISCONNECTED"}
        </span>
      </div>

      {/* Camera Label */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-yellow-400/30">
        <span className="text-white text-xs font-bold">CAM {camId}</span>
      </div>

      {/* P2P LIVE Indicator */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <span className="text-[10px] font-bold text-red-500 uppercase tracking-tighter">
          P2P LIVE
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-3 right-3 bg-red-500/90 backdrop-blur-sm px-3 py-1.5 rounded-lg">
          <span className="text-white text-xs font-bold">{error}</span>
        </div>
      )}

      {/* Loading State */}
      {!isConnected && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-yellow-400 font-semibold">
              Connecting to Camera {camId}...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
