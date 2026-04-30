"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tapo C310 RTSP to WebRTC Stream Component
 *
 * Connects to Tapo C310 camera via RTSP and transcodes to WebRTC using FFmpeg.
 * Ultra-low latency streaming (~200-300ms).
 *
 * @component
 * @example
 * ```tsx
 * <TapoC310Stream
 *   rtspUrl="rtsp://username:password@192.168.1.150/stream1"
 *   transcodingUrl="http://192.168.1.100:8000"
 * />
 * ```
 */

interface TapoC310StreamProps {
  /** RTSP URL of Tapo C310 camera */
  rtspUrl?: string;
  /** URL of transcoding server (FFmpeg + WebRTC) */
  transcodingUrl?: string;
  /** Camera identifier for display */
  camId?: number;
}

interface ConnectionStats {
  ice: "new" | "checking" | "connected" | "completed" | "failed" | "disconnected";
  signaling: "stable" | "have-local-offer" | "have-remote-offer" | "closed";
}

export default function TapoC310Stream({
  rtspUrl = "rtsp://[USER]:[PASS]@192.168.1.150/stream1",
  transcodingUrl = "http://192.168.1.100:8000/stream",
  camId = 1,
}: TapoC310StreamProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string>("");
  const [stats, setStats] = useState<ConnectionStats>({
    ice: "new",
    signaling: "stable",
  });

  const [config, setConfig] = useState({
    rtspUrl,
    transcodingUrl,
  });

  useEffect(() => {
    console.log(`📹 Camera ${camId}: Initializing Tapo C310 WebRTC stream...`);
    console.log(`📡 RTSP URL: ${config.rtspUrl.replace(/:([^:@]{1,10})@/, ":****@")}`);
    console.log(`🌐 Transcoding URL: ${config.transcodingUrl}`);

    let peerConnection: RTCPeerConnection | null = null;
    let isMounted = true;

    /**
     * CONNECT TO RTSP STREAM VIA WEBRTC
     *
     * Architecture:
     * Tapo C310 (RTSP) → FFmpeg Transcoder → WebRTC → Browser
     */
    const connectRTSP = async () => {
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
            setStats((prev) => ({ ...prev, ice: iceState as any }));

            if (iceState === "connected" || iceState === "completed") {
              setIsConnected(true);
              setError("");
            } else if (iceState === "failed") {
              setError("ICE connection failed - check network");
              setIsConnected(false);
            }
          }
        };

        peerConnection.onsignalingstatechange = () => {
          const signalingState = peerConnection!.signalingState || "stable";
          console.log(`📡 Camera ${camId}: Signaling State → ${signalingState}`);

          if (isMounted) {
            setStats((prev) => ({ ...prev, signaling: signalingState as any }));
          }
        };

        // EXECUTE: Attach video stream
        peerConnection.ontrack = (event) => {
          console.log(`📹 Camera ${camId}: Received ${event.track.kind} track`);

          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            console.log(`✅ Camera ${camId}: Video stream attached`);
          }
        };

        // EXECUTE: Create SDP Offer
        console.log(`📤 Camera ${camId}: Creating SDP Offer...`);
        const offer = await peerConnection.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: false,
        });

        await peerConnection.setLocalDescription(offer);

        // EXECUTE: Send Offer to transcoding server
        console.log(`🌐 Camera ${camId}: Sending Offer to transcoding server...`);

        const response = await fetch(config.transcodingUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sdp: peerConnection.localDescription?.sdp,
            type: peerConnection.localDescription?.type,
            rtspUrl: config.rtspUrl,
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // VERIFY: Receive SDP Answer
        const answerData = await response.json();
        console.log(`📥 Camera ${camId}: Received Answer from transcoding server`);

        const remoteDesc = new RTCSessionDescription({
          sdp: answerData.sdp,
          type: answerData.type,
        });

        await peerConnection.setRemoteDescription(remoteDesc);
        console.log(`✅ Camera ${camId}: Remote Description set`);

        console.log(`🎯 Camera ${camId}: Tapo C310 WebRTC connection established!`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        console.error(`❌ Camera ${camId}: RTSP connection failed`, err);

        if (isMounted) {
          setError(errorMsg);
          setIsConnected(false);
        }
      }
    };

    // Validate RTSP URL before connecting
    if (!config.rtspUrl || config.rtspUrl.includes("[USER]")) {
      setError("Please configure RTSP URL with actual username and password");
    } else {
      connectRTSP();
    }

    // CLEANUP: Close connection on unmount
    return () => {
      console.log(`🔌 Camera ${camId}: Cleaning up RTSP connection...`);
      isMounted = false;

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [camId, config.rtspUrl, config.transcodingUrl]);

  return (
    <div className="relative w-full h-full bg-black rounded-2xl overflow-hidden border-2 border-blue-400 shadow-lg">
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
          {isConnected ? "TAPO C310 CONNECTED" : "CONNECTING..."}
        </span>
      </div>

      {/* Camera Label */}
      <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-blue-400/30">
        <span className="text-white text-xs font-bold">TAPO C310 #{camId}</span>
      </div>

      {/* RTSP Badge */}
      <div className="absolute top-3 right-3 flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
        </span>
        <span className="text-[10px] font-bold text-blue-500 uppercase tracking-tighter">
          RTSP → WEBRTC
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
        </div>
      </div>

      {/* Loading State */}
      {!isConnected && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-400 font-semibold">
              Connecting to Tapo C310...
            </p>
            <p className="text-xs text-gray-400">
              RTSP: {config.rtspUrl.replace(/:([^:@]{1,10})@/, ":****@")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
