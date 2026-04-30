"use client";

import { useEffect, useRef, useState } from "react";
import mqtt from "mqtt";

/**
 * WebRTC MQTT Player for RaspberryPi-WebRTC Project
 *
 * Uses MQTT broker as signaling server for WebRTC connection.
 * Compatible with TzuHuanTai/RaspberryPi-WebRTC backend.
 *
 * @component
 * @example
 * ```tsx
 * <WebRTCMQTTPlayer
 *   mqttUrl="ws://192.168.1.100:8083"
 *   uid="water-gate-cam-1"
 *   mqttUsername="hakunamatata"
 *   mqttPassword="Wonderful"
 * />
 * ```
 */

interface WebRTCMQTTPlayerProps {
  /** MQTT broker WebSocket URL (e.g., ws://192.168.1.100:8083) */
  mqttUrl?: string;
  /** Unique camera ID (must match Pi's --uid parameter) */
  uid?: string;
  /** MQTT username (if authentication enabled) */
  mqttUsername?: string;
  /** MQTT password (if authentication enabled) */
  mqttPassword?: string;
  /** Camera identifier for display */
  camId?: number;
}

interface ConnectionStats {
  mqtt: "disconnected" | "connecting" | "connected" | "error";
  ice: "new" | "checking" | "connected" | "completed" | "failed" | "disconnected";
  webrtc: "new" | "connecting" | "connected" | "failed";
}

export default function WebRTCMQTTPlayer({
  mqttUrl = "ws://localhost:8083",
  uid = "water-gate-cam-1",
  mqttUsername = "",
  mqttPassword = "",
  camId = 1,
}: WebRTCMQTTPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const mqttClientRef = useRef<mqtt.MqttClient | null>(null);

  const [stats, setStats] = useState<ConnectionStats>({
    mqtt: "disconnected",
    ice: "new",
    webrtc: "new",
  });

  const [error, setError] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    console.log(`🎥 Camera ${camId}: Initializing MQTT WebRTC...`);
    console.log(`📡 MQTT Broker: ${mqttUrl}`);
    console.log(`🏷️  UID: ${uid}`);

    let peerConnection: RTCPeerConnection | null = null;
    let mqttClient: mqtt.MqttClient | null = null;
    let isMounted = true;

    /**
     * MQTT TOPICS (RaspberryPi-WebRTC protocol)
     * - picamera/{uid}/offer  → Client publishes SDP offer
     * - picamera/{uid}/answer → Pi publishes SDP answer
     * - picamera/{uid}/ice    → Exchange ICE candidates
     */
    const topics = {
      offer: `picamera/${uid}/offer`,
      answer: `picamera/${uid}/answer`,
      ice: `picamera/${uid}/ice`,
    };

    /**
     * STEP 1: Connect to MQTT Broker
     */
    const connectMQTT = async () => {
      try {
        setStats((prev) => ({ ...prev, mqtt: "connecting" }));

        const options: mqtt.IClientOptions = {
          clientId: `web-client-${uid}-${Math.random().toString(16).substr(2, 8)}`,
          clean: true,
          connectTimeout: 30 * 1000,
          reconnectPeriod: 5 * 1000,
        };

        if (mqttUsername && mqttPassword) {
          options.username = mqttUsername;
          options.password = mqttPassword;
        }

        mqttClient = mqtt.connect(mqttUrl, options);
        mqttClientRef.current = mqttClient;

        mqttClient.on("connect", () => {
          console.log(`✅ Camera ${camId}: MQTT Connected to ${mqttUrl}`);
          if (isMounted) {
            setStats((prev) => ({ ...prev, mqtt: "connected" }));
            setError("");
          }

          // Subscribe to answer and ICE topics
          mqttClient!.subscribe([topics.answer, topics.ice], (err) => {
            if (err) {
              console.error(`❌ Camera ${camId}: MQTT subscribe failed`, err);
            } else {
              console.log(`📥 Camera ${camId}: Subscribed to topics`);
            }
          });
        });

        mqttClient.on("error", (err) => {
          console.error(`❌ Camera ${camId}: MQTT error`, err);
          if (isMounted) {
            setStats((prev) => ({ ...prev, mqtt: "error" }));
            setError(`MQTT error: ${err.message}`);
          }
        });

        mqttClient.on("reconnect", () => {
          console.log(`🔄 Camera ${camId}: MQTT reconnecting...`);
        });

        /**
         * STEP 2: Handle MQTT Messages
         */
        mqttClient.on("message", (topic, message) => {
          if (!isMounted) return;

          try {
            const payload = JSON.parse(message.toString());

            if (topic === topics.answer) {
              // Received SDP Answer from Pi
              console.log(`📥 Camera ${camId}: Received SDP Answer from Pi`);
              handleSDPAnswer(payload);
            } else if (topic === topics.ice) {
              // Received ICE candidate from Pi
              console.log(`🧊 Camera ${camId}: Received ICE candidate`);
              handleICECandidate(payload);
            }
          } catch (err) {
            console.error(`❌ Camera ${camId}: Failed to parse MQTT message`, err);
          }
        });

        /**
         * STEP 3: Create WebRTC Peer Connection
         */
        peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });

        peerConnectionRef.current = peerConnection;

        // ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
          const iceState = peerConnection!.iceConnectionState || "new";
          console.log(`🧊 Camera ${camId}: ICE State → ${iceState}`);

          if (isMounted) {
            setStats((prev) => ({ ...prev, ice: iceState as any }));

            if (iceState === "connected" || iceState === "completed") {
              setIsStreaming(true);
            } else if (iceState === "failed") {
              setError("ICE connection failed");
            }
          }
        };

        // Connection state
        peerConnection.onconnectionstatechange = () => {
          const state = peerConnection!.connectionState || "new";
          console.log(`🔗 Camera ${camId}: WebRTC State → ${state}`);

          if (isMounted) {
            setStats((prev) => ({ ...prev, webrtc: state as any }));

            if (state === "connected") {
              setIsStreaming(true);
              setError("");
            } else if (state === "failed") {
              setError("WebRTC connection failed");
              setIsStreaming(false);
            }
          }
        };

        // Attach video track
        peerConnection.ontrack = (event) => {
          console.log(`📹 Camera ${camId}: Received video track`);

          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            console.log(`✅ Camera ${camId}: Video stream attached`);
          }
        };

        // Send ICE candidates to Pi via MQTT
        peerConnection.onicecandidate = (event) => {
          if (event.candidate && mqttClient && mqttClient.connected) {
            console.log(`🧊 Camera ${camId}: Sending ICE candidate to Pi`);
            mqttClient.publish(topics.ice, JSON.stringify(event.candidate));
          }
        };

        /**
         * STEP 4: Create and Send SDP Offer
         */
        console.log(`📤 Camera ${camId}: Creating SDP Offer...`);
        const offer = await peerConnection.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: false,
        });

        await peerConnection.setLocalDescription(offer);

        // Wait for ICE gathering to complete
        await new Promise<void>((resolve) => {
          if (peerConnection!.iceGatheringState === "complete") {
            resolve();
          } else {
            peerConnection!.onicegatheringstatechange = () => {
              if (peerConnection!.iceGatheringState === "complete") {
                resolve();
              }
            };
          }
        });

        // Send offer to Pi via MQTT
        const offerPayload = {
          sdp: peerConnection.localDescription!.sdp,
          type: peerConnection.localDescription!.type,
        };

        console.log(`📤 Camera ${camId}: Publishing SDP Offer to ${topics.offer}`);
        mqttClient.publish(topics.offer, JSON.stringify(offerPayload));

        console.log(`🎯 Camera ${camId}: WebRTC handshake initiated!`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`❌ Camera ${camId}: Initialization failed`, err);
        if (isMounted) {
          setError(errorMsg);
        }
      }
    };

    connectMQTT();

    /**
     * CLEANUP: Close connections on unmount
     */
    return () => {
      console.log(`🔌 Camera ${camId}: Cleaning up...`);
      isMounted = false;

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (mqttClientRef.current) {
        mqttClientRef.current.end();
        mqttClientRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [camId, mqttUrl, uid, mqttUsername, mqttPassword]);

  /**
   * Handle SDP Answer from Raspberry Pi
   */
  const handleSDPAnswer = async (payload: any) => {
    try {
      if (!peerConnectionRef.current) return;

      const answer = new RTCSessionDescription({
        sdp: payload.sdp,
        type: payload.type,
      });

      await peerConnectionRef.current.setRemoteDescription(answer);
      console.log(`✅ Camera ${camId}: Remote description set`);
    } catch (err) {
      console.error(`❌ Camera ${camId}: Failed to set remote description`, err);
      setError("Failed to set remote description");
    }
  };

  /**
   * Handle ICE Candidate from Raspberry Pi
   */
  const handleICECandidate = async (payload: any) => {
    try {
      if (!peerConnectionRef.current) return;

      await peerConnectionRef.current.addIceCandidate(
        new RTCIceCandidate(payload)
      );
      console.log(`✅ Camera ${camId}: ICE candidate added`);
    } catch (err) {
      console.error(`❌ Camera ${camId}: Failed to add ICE candidate`, err);
    }
  };

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-purple-400 shadow-lg">
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Connection Status */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            stats.mqtt === "connected" ? "bg-green-500" : "bg-red-500"
          } ${stats.mqtt === "connecting" ? "animate-pulse" : ""}`}
        />
        <span className="text-[10px] font-bold text-white uppercase tracking-tighter">
          MQTT: {stats.mqtt}
        </span>
      </div>

      {/* WebRTC Status */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        {isStreaming && (
          <>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500" />
            </span>
            <span className="text-[10px] font-bold text-purple-500 uppercase tracking-tighter">
              LIVE
            </span>
          </>
        )}
      </div>

      {/* Camera Label */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-purple-400/30">
        <span className="text-white text-xs font-bold">CAM {camId} (MQTT)</span>
      </div>

      {/* Debug Info */}
      {error && (
        <div className="absolute bottom-3 right-3 bg-red-500/90 backdrop-blur-sm px-3 py-1.5 rounded-lg max-w-xs">
          <p className="text-white text-xs font-bold">{error}</p>
        </div>
      )}

      {/* Connection States */}
      <div className="absolute bottom-16 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
        <div className="text-[9px] text-gray-300 font-mono space-y-0.5">
          <div>MQTT: {stats.mqtt}</div>
          <div>ICE: {stats.ice}</div>
          <div>WebRTC: {stats.webrtc}</div>
        </div>
      </div>

      {/* Loading State */}
      {!isStreaming && !error && stats.mqtt !== "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-purple-400 font-semibold">
              Connecting via MQTT...
            </p>
            <p className="text-xs text-gray-400">
              UID: {uid} | Broker: {mqttUrl}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
