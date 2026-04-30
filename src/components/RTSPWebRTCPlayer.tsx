"use client";

import { useEffect, useRef, useState } from "react";

/**
 * RTSP to WebRTC Player for RaspberryPi-WebRTC Project
 *
 * Connects to Raspberry Pi 4 running pi-webrtc which pulls RTSP stream
 * from Tapo C310 camera and transcodes to WebRTC.
 *
 * Architecture:
 * Tapo C310 (RTSP) → Raspberry Pi (pi-webrtc) → WebRTC → Browser
 *
 * @component
 * @example
 * ```tsx
 * <RTSPWebRTCPlayer
 *   signalingUrl="http://192.168.1.151:8000/stream"
 *   rtspUrl="rtsp://admin:password@192.168.1.150/stream1"
 * />
 * ```
 */

interface RTSPWebRTCPlayerProps {
  /** pi-webrtc signaling endpoint on Raspberry Pi */
  signalingUrl?: string;
  /** RTSP URL of Tapo C310 camera */
  rtspUrl?: string;
  /** Camera identifier for display */
  camId?: number;
  /** Use Next.js API proxy to bypass CORS (default: true) */
  useProxy?: boolean;
}

interface ConnectionStats {
  ice: "new" | "checking" | "connected" | "completed" | "failed" | "disconnected";
  signaling: "stable" | "have-local-offer" | "have-remote-offer" | "closed";
  peer: "new" | "connecting" | "connected" | "disconnected" | "failed" | "closed";
}

export default function RTSPWebRTCPlayer({
  signalingUrl = "http://192.168.1.151:8000/stream",
  rtspUrl = "rtsp://admin:password@192.168.1.150/stream1",
  camId = 1,
  useProxy = true,
}: RTSPWebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>("");
  const [stats, setStats] = useState<ConnectionStats>({
    ice: "new",
    signaling: "stable",
    peer: "new",
  });

  useEffect(() => {
    console.log(`🎥 Camera ${camId}: Initializing RTSP → WebRTC stream...`);
    console.log(`📹 RTSP Source: ${rtspUrl.replace(/:([^:@]{1,10})@/, ":****@")}`);
    console.log(`🌐 Pi Signaling: ${signalingUrl}`);
    console.log(`🛡️ CORS Proxy: ${useProxy ? "ENABLED" : "DISABLED"}`);

    let peerConnection: RTCPeerConnection | null = null;
    let isMounted = true;

    /**
     * CONNECT TO RASPBERRY PI (pi-webrtc)
     *
     * Architecture:
     * Tapo C310 (RTSP) → Raspberry Pi (pi-webrtc) → WebRTC → Browser
     *
     * With useProxy=true:
     * Browser → Next.js API Proxy → Raspberry Pi (pi-webrtc)
     */
    const connectToPi = async () => {
      try {
        // BUILD: Create RTCPeerConnection
        peerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        });

        peerConnectionRef.current = peerConnection;

        // EXECUTE: Connection state monitoring
        peerConnection.oniceconnectionstatechange = () => {
          const iceState = peerConnection!.iceConnectionState || "new";
          console.log(`🧊 Camera ${camId}: ICE State → ${iceState}`);

          if (isMounted) {
            setStats((prev) => ({
              ...prev,
              ice: iceState as RTCIceConnectionState,
            }));

            if (iceState === "connected" || iceState === "completed") {
              setIsConnected(true);
              setError("");
            } else if (iceState === "failed") {
              setError("ICE connection failed - check Pi and network");
              setIsConnected(false);
            }
          }
        };

        peerConnection.onsignalingstatechange = () => {
          const signalingState = peerConnection!.signalingState || "stable";
          console.log(`📡 Camera ${camId}: Signaling State → ${signalingState}`);

          if (isMounted) {
            setStats((prev) => ({
              ...prev,
              signaling: signalingState as RTCSignalingState,
            }));
          }
        };

        peerConnection.onconnectionstatechange = () => {
          const peerState = peerConnection!.connectionState || "new";
          console.log(`🔗 Camera ${camId}: Peer Connection → ${peerState}`);

          if (isMounted) {
            setStats((prev) => ({
              ...prev,
              peer: peerState as RTCPeerConnectionState,
            }));

            if (peerState === "connected") {
              setIsConnected(true);
              setError("");
            } else if (peerState === "failed") {
              setError("WebRTC connection failed");
              setIsConnected(false);
            }
          }
        };

        // EXECUTE: Attach video stream from Pi
        peerConnection.ontrack = (event) => {
          console.log(`📹 Camera ${camId}: Received ${event.track.kind} track from Pi`);

          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            console.log(`✅ Camera ${camId}: Video stream attached to element`);
          }
        };

        // Send ICE candidates to Pi
        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(`🧊 Camera ${camId}: Sending ICE candidate to Pi`);
            // Note: pi-webrtc handles ICE candidates internally via the signaling server
          }
        };

        // EXECUTE: Add transceiver for video-only reception (modern approach)
        console.log(`📤 Camera ${camId}: Adding video transceiver (recvonly)...`);
        peerConnection.addTransceiver("video", { direction: "recvonly" });

        // EXECUTE: Create SDP Offer
        console.log(`📤 Camera ${camId}: Creating SDP Offer...`);
        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);
        console.log(`✅ Camera ${camId}: Local Description set`);

        // EXECUTE: Send Offer to Raspberry Pi signaling server
        const targetUrl = useProxy ? "/api/webrtc-proxy" : signalingUrl;
        console.log(`🌐 Camera ${camId}: Sending Offer to ${useProxy ? "Next.js Proxy → " : ""}Pi at ${targetUrl}...`);

        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sdp: peerConnection.localDescription?.sdp,
            type: peerConnection.localDescription?.type,
            rtsp_url: rtspUrl, // pi-webrtc expects "rtsp_url" parameter
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // VERIFY: Receive SDP Answer from Pi
        const answerData = await response.json();
        console.log(`📥 Camera ${camId}: Received Answer from Pi`);

        const remoteDesc = new RTCSessionDescription({
          sdp: answerData.sdp,
          type: answerData.type,
        });

        await peerConnection.setRemoteDescription(remoteDesc);
        console.log(`✅ Camera ${camId}: Remote Description set`);

        console.log(`🎯 Camera ${camId}: WebRTC connection established!`);
        console.log(`📊 Architecture: Tapo C310 → Pi (pi-webrtc) → Dashboard`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`❌ Camera ${camId}: Connection failed`, err);

        if (isMounted) {
          setError(errorMsg);
          setIsConnected(false);
        }
      }
    };

    // Validate configuration before connecting
    if (!rtspUrl || rtspUrl.includes("[USER]") || rtspUrl.includes("[PASS]")) {
      setError("Please configure RTSP URL with actual username and password");
    } else if (!signalingUrl) {
      setError("Please configure Raspberry Pi signaling URL");
    } else {
      connectToPi();
    }

    // CLEANUP: Close connection on unmount
    return () => {
      console.log(`🔌 Camera ${camId}: Cleaning up connection...`);
      isMounted = false;

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [camId, signalingUrl, rtspUrl]);

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-orange-400 shadow-lg">
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
            isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
          }`}
        />
        <span className="text-[10px] font-bold text-white uppercase tracking-tighter">
          {isConnected ? "PI WEBRTC CONNECTED" : "CONNECTING..."}
        </span>
      </div>

      {/* Camera Label */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-orange-400/30">
        <span className="text-white text-xs font-bold">TAPO C310 → PI #{camId}</span>
      </div>

      {/* Architecture Badge */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
        </span>
        <span className="text-[10px] font-bold text-orange-500 uppercase tracking-tighter">
          RTSP → PI → WEBRTC
        </span>
      </div>

      {/* Error Message */}
      {error && (
        <div className="absolute bottom-3 right-3 bg-red-500/90 backdrop-blur-sm px-3 py-1.5 rounded-lg max-w-xs">
          <p className="text-white text-xs font-bold">{error}</p>
        </div>
      )}

      {/* Connection States */}
      <div className="absolute bottom-16 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg">
        <div className="text-[9px] text-gray-300 font-mono space-y-0.5">
          <div>ICE: {stats.ice}</div>
          <div>Signal: {stats.signaling}</div>
          <div>Peer: {stats.peer}</div>
        </div>
      </div>

      {/* Loading State */}
      {!isConnected && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-orange-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-orange-400 font-semibold">
              Connecting to Raspberry Pi...
            </p>
            <p className="text-xs text-gray-400">
              Pi: {signalingUrl.replace(/^https?:\/\//, "").replace(/\/.*$/, "")}
            </p>
            <p className="text-xs text-gray-400">
              RTSP: {rtspUrl.replace(/:([^:@]{1,10})@/, ":****@")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
