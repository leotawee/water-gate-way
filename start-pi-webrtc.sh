#!/bin/bash

################################################################################
# Raspberry Pi WebRTC Startup Script for Water Gate Way System
#
# This script starts pi-webrtc to pull RTSP stream from Tapo C310
# and serve it via WebRTC to the dashboard.
#
# Architecture:
# Tapo C310 (192.168.1.150) → RTSP → Pi (192.168.1.151) → WebRTC → Dashboard
################################################################################

# ==================== CONFIGURATION ====================

# RTSP URL of Tapo C310 camera
RTSP_URL="rtsp://admin:password@192.168.1.150/stream1"

# pi-webrtc settings
CAMERA_ID="water-gate-tapo-1"
SIGNALING_PORT=8000
FPS=30
WIDTH=1280
HEIGHT=960

# Binary location
PI_WEBRTC_BIN="./pi-webrtc"

# Log file
LOG_FILE="pi-webrtc.log"

# ==================== VALIDATION ====================

echo "🏰 Water Gate Way System - Raspberry Pi WebRTC Streamer"
echo "======================================================"
echo ""

# Check if pi-webrtc binary exists
if [ ! -f "$PI_WEBRTC_BIN" ]; then
    echo "❌ ERROR: pi-webrtc binary not found!"
    echo "   Expected location: $PI_WEBRTC_BIN"
    echo ""
    echo "📥 Download from:"
    echo "   https://github.com/TzuHuanTai/RaspberryPi-WebRTC/releases"
    exit 1
fi

# Check if pi-webrtc is executable
if [ ! -x "$PI_WEBRTC_BIN" ]; then
    echo "⚠️  Making pi-webrtc executable..."
    chmod +x "$PI_WEBRTC_BIN"
fi

# ==================== DISPLAY CONFIG ====================

echo "📹 Configuration:"
echo "   RTSP Source: $RTSP_URL"
echo "   Camera ID: $CAMERA_ID"
echo "   Signaling Port: $SIGNALING_PORT"
echo "   Resolution: ${WIDTH}x${HEIGHT} @ ${FPS}fps"
echo ""

# ==================== START PI-WEBRTC ====================

echo "🚀 Starting pi-webrtc..."
echo "   Signaling endpoint: http://0.0.0.0:${SIGNALING_PORT}/stream"
echo "   Log file: $LOG_FILE"
echo ""
echo "⚠️  Press Ctrl+C to stop"
echo ""

# Run pi-webrtc with RTSP input
$PI_WEBRTC_BIN \
    --camera=rtsp:${RTSP_URL} \
    --fps=${FPS} \
    --width=${WIDTH} \
    --height=${HEIGHT} \
    --use-http \
    --http-port=${SIGNALING_PORT} \
    --uid=${CAMERA_ID} \
    --no-audio \
    --hw-accel \
    2>&1 | tee $LOG_FILE

# Exit code
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ pi-webrtc stopped successfully"
else
    echo "❌ pi-webrtc exited with error code: $EXIT_CODE"
    echo "   Check log file: $LOG_FILE"
fi

exit $EXIT_CODE
