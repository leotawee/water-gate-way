"use client";

import { useEffect, useRef, useState } from "react";

/**
 * WebRTC Video Player Component
 *
 * Connects to Raspberry Pi 4 WebRTC streamer for ultra-low latency video.
 * Browser acts as OFFERER in the WebRTC handshake.
 *
 * @component
 * @example
 * ```tsx
 * <WebRTCPlayer
 *   signalingUrl="http://192.168.1.100:8000/stream"
 *   stunServer="stun:stun.l.google.com:19302"
 * />
 * ```
 */

interface WebRTCPlayerProps {
  /** Backend signaling server endpoint (e.g., http://192.168.x.x:8000/stream) */
  signalingUrl?: string;
  /** STUN server URL for ICE negotiation */
  stunServer?: string;
  /** Camera identifier for display */
  camId?: number;
}

interface ConnectionStats {
  iceState: string;
  signalingState: string;
  peerState: string;
}

export default function WebRTCPlayer({
  signalingUrl = "[PI_SIGNALING_URL]",
  stunServer = "[STUN_SERVER_URL]",
  camId = 1,
}: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [stats, setStats] = useState<ConnectionStats>({
    iceState: "new",
    signalingState: "stable",
    peerState: "new",
  });

  useEffect(() => {
    console.log(`🎥 Camera ${camId}: Initializing WebRTC connection to ${signalingUrl}`);

    let peerConnection: RTCPeerConnection | null = null;
    let isMounted = true;

    /**
     * CREATE OFFER & NEGOTIATE CONNECTION
     * Following the 7 Grand Archer Steps: OBSERVE → THINK → PLAN → BUILD → EXECUTE → VERIFY → LEARN
     */
    const connectWebRTC = async () => {
      try {
        // BUILD: Initialize RTCPeerConnection with STUN server
        peerConnection = new RTCPeerConnection({
          iceServers: [{ urls: stunServer }],
        });

        peerConnectionRef.current = peerConnection;

        // EXECUTE: Set up event listeners for debugging
        peerConnection.oniceconnectionstatechange = () => {
          const iceState = peerConnection?.iceConnectionState || "unknown";
          console.log(`🧊 Camera ${camId}: ICE State → ${iceState}`);

          if (isMounted) {
            setStats((prev) => ({ ...prev, iceState }));

            if (iceState === "connected" || iceState === "completed") {
              setIsConnected(true);
              setError("");
            } else if (iceState === "failed" || iceState === "disconnected") {
              setIsConnected(false);
              setError(`ICE ${iceState}`);
            }
          }
        };

        peerConnection.onsignalingstatechange = () => {
          const signalingState = peerConnection?.signalingState || "unknown";
          console.log(`📡 Camera ${camId}: Signaling State → ${signalingState}`);

          if (isMounted) {
            setStats((prev) => ({ ...prev, signalingState }));
          }
        };

        peerConnection.onconnectionstatechange = () => {
          const peerState = peerConnection?.connectionState || "unknown";
          console.log(`🔗 Camera ${camId}: Peer Connection State → ${peerState}`);

          if (isMounted) {
            setStats((prev) => ({ ...prev, peerState }));

            if (peerState === "connected") {
              setIsConnected(true);
              setError("");
            } else if (peerState === "failed" || peerState === "disconnected") {
              setIsConnected(false);
              setError(`Connection ${peerState}`);
            }
          }
        };

        // EXECUTE: Attach incoming video track to video element
        peerConnection.ontrack = (event) => {
          console.log(`📹 Camera ${camId}: Received ${event.track.kind} track`);

          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            console.log(`✅ Camera ${camId}: Video stream attached to element`);
          }
        };

        // EXECUTE: Create SDP Offer (as OFFERER)
        console.log(`📤 Camera ${camId}: Creating SDP Offer...`);
        const offer = await peerConnection.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: false,
        });

        await peerConnection.setLocalDescription(offer);
        console.log(`✅ Camera ${camId}: Local Description set`);

        // EXECUTE: Send Offer to backend via HTTP POST
        console.log(`🌐 Camera ${camId}: Sending Offer to ${signalingUrl}...`);
        const response = await fetch(signalingUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sdp: peerConnection.localDescription?.sdp,
            type: peerConnection.localDescription?.type,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // VERIFY: Receive SDP Answer from backend
        const answerData = await response.json();
        console.log(`📥 Camera ${camId}: Received Answer from backend`);

        const remoteDesc = new RTCSessionDescription({
          sdp: answerData.sdp,
          type: answerData.type,
        });

        await peerConnection.setRemoteDescription(remoteDesc);
        console.log(`✅ Camera ${camId}: Remote Description set`);

        // LEARN: Log success for hardware team debugging
        console.log(`🎯 Camera ${camId}: WebRTC handshake complete!`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`❌ Camera ${camId}: WebRTC connection failed`, err);

        if (isMounted) {
          setError(errorMsg);
          setIsConnected(false);
        }
      }
    };

    connectWebRTC();

    // CLEANUP: Close peer connection on unmount
    return () => {
      console.log(`🔌 Camera ${camId}: Cleaning up WebRTC connection...`);
      isMounted = false;

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [camId, signalingUrl, stunServer]);

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-emerald-400 shadow-lg">
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />

      {/* Connection Status Indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full ${
            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
        <span className="text-[10px] font-bold text-white uppercase tracking-tighter">
          {isConnected ? "WEBRTC CONNECTED" : "CONNECTING..."}
        </span>
      </div>

      {/* Camera Label */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-emerald-400/30">
        <span className="text-white text-xs font-bold">CAM {camId} (WebRTC)</span>
      </div>

      {/* Low Latency Badge */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>
        <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">
          ULTRA LOW LATENCY
        </span>
      </div>

      {/* Debug Info (for hardware team) */}
      {error && (
        <div className="absolute bottom-3 right-3 bg-red-500/90 backdrop-blur-sm px-3 py-1.5 rounded-lg max-w-xs">
          <p className="text-white text-xs font-bold">{error}</p>
        </div>
      )}

      {/* Connection States (visible when not connected) */}
      {!isConnected && (
        <div className="absolute bottom-16 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
          <div className="text-[9px] text-gray-300 font-mono space-y-0.5">
            <div>ICE: {stats.iceState}</div>
            <div>Signal: {stats.signalingState}</div>
            <div>Peer: {stats.peerState}</div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {!isConnected && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-emerald-400 font-semibold">
              Establishing WebRTC Connection...
            </p>
            <p className="text-xs text-gray-400">
              Camera {camId} - Signaling: {signalingUrl}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
