# Raspberry Pi WebRTC Setup Guide for Water Gate Way System

## Overview

This guide explains how to setup **Raspberry Pi 4** to pull RTSP stream from **Tapo C310 camera** and serve it via **WebRTC** to the Water Gate Way dashboard using the **pi-webrtc** binary from [TzuHuanTai/RaspberryPi-WebRTC](https://github.com/TzuHuanTai/RaspberryPi-WebRTC).

---

## System Architecture

```
┌──────────────┐         RTSP          ┌─────────────┐        WebRTC        ┌──────────────┐
│              │ ──────────────────────> │             │ ─────────────────────> │              │
│  Tapo C310   │   rtsp://user:pass@IP  │  Raspberry  │   HTTP signaling      │   Browser    │
│   Camera     │                          │     Pi      │        + stream       │  Dashboard   │
│              │                          │ (pi-webrtc) │                        │              │
└──────────────┘                           └─────────────┘                        └──────────────┘
  192.168.1.150                              192.168.1.151

Latency: ~150-200ms (ultra-low)
Quality: 1280x960 @ 30fps
```

---

## Hardware Requirements

- **Raspberry Pi 4** (4GB+ RAM recommended)
- **Tapo C310 Camera** with RTSP enabled
- **Wired Ethernet** connection (recommended)
- **MicroSD Card** (16GB+ Class 10)

---

## Step 1: Enable RTSP on Tapo C310

### Using Tapo App

1. Open **Tapo app** on your phone
2. Tap on your **Tapo C310** camera
3. Go to **Settings** → **Advanced Settings**
4. Find **RTSP** section
5. Toggle **"Enable RTSP"** to ON
6. Set **username** and **password**
7. Tap **Save**

### Get RTSP URL

After enabling RTSP, you'll get an URL like:

```
rtsp://USERNAME:PASSWORD@192.168.1.150/stream1
```

**URL Format:**
- `USERNAME`: Your Tapo camera username
- `PASSWORD`: Your Tapo camera password
- `192.168.1.150`: Tapo camera IP address
- `/stream1`: Main stream (1080p)
- `/stream2`: Sub stream (720p, lower latency)

### Test RTSP Stream with VLC

1. Open **VLC Media Player**
2. File → Open Network
3. Enter RTSP URL: `rtsp://USERNAME:PASSWORD@192.168.1.150/stream1`
4. Click **Play**
5. Video should appear within ~2 seconds

---

## Step 2: Setup Raspberry Pi

### Flash Raspberry Pi OS

1. Download **Raspberry Pi Imager**: https://www.raspberrypi.com/software/
2. Use it to flash **Raspberry Pi OS Lite (64-bit)** to SD card
3. Enable **SSH** during imaging (click the gear icon ⚙️)
4. Insert SD card into Pi and power on

### SSH into Raspberry Pi

```bash
ssh pi@raspberrypi.local
# Default password: raspberry
# Or use: ssh pi@192.168.1.151
```

### Update System

```bash
sudo apt update
sudo apt upgrade -y
sudo reboot
```

---

## Step 3: Download pi-webrtc Binary

### Get Latest Release

```bash
# Create directory for pi-webrtc
mkdir -p ~/pi-webrtc
cd ~/pi-webrtc

# Download latest release for Raspberry Pi OS (64-bit)
wget https://github.com/TzuHuanTai/RaspberryPi-WebRTC/releases/latest/download/pi-webrtc_raspios-trixie-arm64.tar.gz

# Extract
tar -xzf pi-webrtc_raspios-trixie-arm64.tar.gz

# Make executable
chmod +x pi-webrtc

# Test run
./pi-webrtc --help
```

### Expected Output

You should see help text with available options like:
```
pi-webrtc [options]

Options:
  --camera=TYPE         Camera type (libcamera, rtsp, v4l2)
  --camera=rtsp:URL     RTSP camera URL
  --use-http           Use HTTP signaling
  --http-port=PORT      HTTP signaling port (default: 8000)
  --uid=ID              Unique camera ID
  --fps=N               Frames per second
  --width=N             Video width
  --height=N            Video height
  --hw-accel            Enable hardware acceleration
  --no-audio            Disable audio
```

---

## Step 4: Configure Startup Script

### Copy Script to Raspberry Pi

Copy the `start-pi-webrtc.sh` script from the Water Gate Way project to your Raspberry Pi:

```bash
# On your PC, copy script to Pi:
scp start-pi-webrtc.sh pi@192.168.1.151:~/pi-webrtc/

# Or create manually on Pi:
nano ~/pi-webrtc/start-pi-webrtc.sh
```

### Edit Configuration

```bash
nano ~/pi-webrtc/start-pi-webrtc.sh
```

Update these variables:

```bash
# RTSP URL of Tapo C310 camera
RTSP_URL="rtsp://admin:YOUR_PASSWORD@192.168.1.150/stream1"

# pi-webrtc settings
CAMERA_ID="water-gate-tapo-1"
SIGNALING_PORT=8000
FPS=30
WIDTH=1280
HEIGHT=960
```

### Make Script Executable

```bash
chmod +x ~/pi-webrtc/start-pi-webrtc.sh
```

---

## Step 5: Start pi-webrtc

### Manual Start (Testing)

```bash
cd ~/pi-webrtc
./start-pi-webrtc.sh
```

You should see output like:

```
🏰 Water Gate Way System - Raspberry Pi WebRTC Streamer
======================================================

📹 Configuration:
   RTSP Source: rtsp://admin:****@192.168.1.150/stream1
   Camera ID: water-gate-tapo-1
   Signaling Port: 8000
   Resolution: 1280x960 @ 30fps

🚀 Starting pi-webrtc...
   Signaling endpoint: http://0.0.0.0:8000/stream
   Log file: pi-webrtc.log

⚠️  Press Ctrl+C to stop
```

### Test Connection from Dashboard

1. Open Water Gate Way dashboard: `http://localhost:3000`
2. Navigate to camera monitor
3. Configure:
   - **Signaling URL:** `http://192.168.1.151:8000/stream`
   - **RTSP URL:** `rtsp://admin:password@192.168.1.150/stream1`
4. Video should appear within ~2-3 seconds

---

## Step 6: Auto-start on Boot (Optional)

### Create Systemd Service

```bash
sudo nano /etc/systemd/system/pi-webrtc.service
```

Add this content:

```ini
[Unit]
Description=Pi WebRTC Streamer for Water Gate Way
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pi-webrtc
ExecStart=/home/pi/pi-webrtc/pi-webrtc \
    --camera=rtsp:rtsp://admin:YOUR_PASSWORD@192.168.1.150/stream1 \
    --fps=30 \
    --width=1280 \
    --height=960 \
    --use-http \
    --http-port=8000 \
    --uid=water-gate-tapo-1 \
    --no-audio \
    --hw-accel
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable pi-webrtc
sudo systemctl start pi-webrtc
sudo systemctl status pi-webrtc
```

### Check Status

```bash
# Check if service is running
sudo systemctl status pi-webrtc

# View logs
journalctl -u pi-webrtc -f

# Restart service
sudo systemctl restart pi-webrtc

# Stop service
sudo systemctl stop pi-webrtc
```

---

## Step 7: Frontend Integration

### Using RTSPWebRTCPlayer Component

```tsx
import RTSPWebRTCPlayer from "@/components/RTSPWebRTCPlayer";

<RTSPWebRTCPlayer
  signalingUrl="http://192.168.1.151:8000/stream"
  rtspUrl="rtsp://admin:password@192.168.1.150/stream1"
  camId={1}
/>
```

### Configuration Parameters

| Parameter | Example | Description |
|-----------|---------|-------------|
| `signalingUrl` | `http://192.168.1.151:8000/stream` | pi-webrtc HTTP endpoint |
| `rtspUrl` | `rtsp://admin:pass@192.168.1.150/stream1` | Tapo C310 RTSP URL |
| `camId` | `1` | Camera display ID |

---

## Performance Optimization

### For Lowest Latency (~150ms)

1. **Use wired Ethernet** for both Pi and camera
2. **Use sub-stream** (lower quality):
   ```bash
   RTSP_URL="rtsp://admin:password@192.168.1.150/stream2"
   ```
3. **Reduce resolution:**
   ```bash
   WIDTH=640
   HEIGHT=480
   ```
4. **Enable hardware acceleration:**
   ```bash
   --hw-accel
   ```

### For Best Quality

1. **Use main-stream** (higher quality):
   ```bash
   RTSP_URL="rtsp://admin:password@192.168.1.150/stream1"
   ```
2. **Increase resolution:**
   ```bash
   WIDTH=1920
   HEIGHT=1080
   ```
3. **Increase FPS:**
   ```bash
   FPS=60
   ```

---

## Troubleshooting

### Issue: pi-webrtc fails to start

**Solution:**
1. Check if binary exists:
   ```bash
   ls -l ~/pi-webrtc/pi-webrtc
   ```
2. Check if executable:
   ```bash
   chmod +x ~/pi-webrtc/pi-webrtc
   ```
3. Check architecture:
   ```bash
   uname -m
   # Should show: aarch64
   ```

### Issue: RTSP connection failed

**Solution:**
1. Test RTSP URL with VLC
2. Check camera is reachable:
   ```bash
   ping 192.168.1.150
   ```
3. Verify RTSP URL format:
   ```bash
   rtsp://USERNAME:PASSWORD@192.168.1.150/stream1
   ```

### Issue: High latency (>500ms)

**Solution:**
1. Use wired Ethernet instead of WiFi
2. Reduce resolution: `640x480`
3. Use sub-stream: `/stream2`
4. Check network congestion

### Issue: No video stream

**Solution:**
1. Check pi-webrtc logs:
   ```bash
   tail -f ~/pi-webrtc/pi-webrtc.log
   ```
2. Verify signaling URL is correct
3. Check browser console (F12) for errors
4. Ensure STUN server is accessible

### Issue: Connection drops frequently

**Solution:**
1. Increase camera buffer size
2. Use wired Ethernet
3. Restart camera and Pi
4. Check RTSP timeout settings

---

## Monitoring

### View pi-webrtc Logs

```bash
# Real-time logs
tail -f ~/pi-webrtc/pi-webrtc.log

# Last 50 lines
tail -n 50 ~/pi-webrtc/pi-webrtc.log

# Search for errors
grep -i error ~/pi-webrtc/pi-webrtc.log
```

### Monitor System Resources

```bash
# CPU usage
top -p $(pgrep pi-webrtc)

# Memory usage
free -h

# Network connection
netstat -tuln | grep 8000
```

### Test Signaling Endpoint

```bash
# Test if port 8000 is listening
curl http://192.168.1.151:8000

# Test with SDP offer
curl -X POST http://192.168.1.151:8000/stream \
  -H "Content-Type: application/json" \
  -d '{"sdp": "test", "type": "offer", "rtsp_url": "rtsp://admin:password@192.168.1.150/stream1"}'
```

---

## Security Best Practices

1. **Use strong password** for Tapo camera RTSP
2. **Don't expose port 8000** to public internet
3. **Use firewall** to restrict access:
   ```bash
   sudo ufw allow from 192.168.1.0/24 to any port 8000
   ```
4. **Keep pi-webrtc updated** to latest version
5. **Monitor logs** for suspicious activity

---

## Architecture Diagram

```
Water Gate Way System Architecture
==================================

┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Next.js Dashboard (http://localhost:3000)            │  │
│  │  - RTSPWebRTCPlayer component                        │  │
│  │  - HTTP POST signaling to Pi                         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST (SDP Offer/Answer)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TRANSCODING LAYER                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Raspberry Pi 4 (192.168.1.151)                       │  │
│  │  - pi-webrtc binary                                   │  │
│  │  - Port 8000: HTTP signaling server                   │  │
│  │  - FFmpeg: RTSP → WebRTC transcoding                 │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ RTSP Stream
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       CAMERA LAYER                           │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Tapo C310 (192.168.1.150)                            │  │
│  │  - RTSP server (port 554)                             │  │
│  │  - H.264 video encoder                                │  │
│  │  - 1080p @ 30fps                                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

Total Latency: ~150-200ms (Tapo → RTSP → Pi → WebRTC → Dashboard)
```

---

## Resources

- **RaspberryPi-WebRTC GitHub:** https://github.com/TzuHuanTai/RaspberryPi-WebRTC
- **Tapo C310 Support:** https://www.tp-link.com/support/
- **WebRTC Basics:** https://webrtc.org/
- **FFmpeg Documentation:** https://ffmpeg.org/documentation.html

---

## Next Steps

1. ✅ Enable RTSP on Tapo C310
2. ✅ Download pi-webrtc to Raspberry Pi
3. ✅ Configure startup script with RTSP URL
4. ✅ Start pi-webrtc and test connection
5. ✅ Setup auto-start service (optional)
6. ✅ Integrate with Water Gate Way dashboard

---

**Status:** Ready for Production Deployment 🚀

**Last Updated:** 2026-04-22
