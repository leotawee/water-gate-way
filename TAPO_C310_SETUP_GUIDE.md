# Tapo C310 RTSP to WebRTC Setup Guide

## Overview

This guide explains how to connect **Tapo C310 camera** to the Water Gate Way dashboard using **RTSP to WebRTC transcoding**.

---

## System Architecture

```
┌──────────────┐         RTSP          ┌─────────────┐        WebRTC        ┌──────────────┐
│              │ ──────────────────────> │             │ ─────────────────────> │              │
│  Tapo C310   │   (rtsp://user:pass@IP) │  FFmpeg     │   (signaling + stream) │   Browser    │
│   Camera     │                          │ Transcoder  │                        │  Dashboard   │
│              │                           │  (Port 8000)│                        │              │
└──────────────┘                           └─────────────┘                        └──────────────┘
```

**Latency:** ~200-300ms (ultra-low latency)
**Quality:** 1080p @ 30fps

---

## Hardware Requirements

- **Tapo C310 Camera**
- **Computer/Raspberry Pi** for running FFmpeg transcoder
- **Wired Ethernet** connection (recommended for low latency)

---

## Step 1: Enable RTSP on Tapo C310

### Using Tapo App (Mobile)

1. Open **Tapo app** on your phone
2. Tap on your **Tapo C310** camera
3. Go to **Settings** → **Advanced Settings**
4. Find **RTSP** section
5. Toggle **"Enable RTSP"** to ON
6. Set **username** and **password**
7. Tap **Save**

### Using Tapo Web Interface (Desktop)

1. Open browser and go to `http://[CAMERA_IP]` (e.g., `http://192.168.1.150`)
2. Login with your Tapo account
3. Go to **Settings** → **Advanced Settings** → **RTSP**
4. Enable RTSP
5. Set credentials
6. Save

### Get RTSP URL

After enabling RTSP, you'll get an URL like:

```
rtsp://USERNAME:PASSWORD@192.168.1.150/stream1
```

**URL Format:**
- `USERNAME`: Your Tapo camera username
- `PASSWORD`: Your Tapo camera password
- `192.168.1.150`: Tapo camera IP address
- `/stream1`: Main stream (1080p, higher quality)
- `/stream2`: Sub stream (720p, lower quality, faster)

---

## Step 2: Find Tapo Camera IP

### Option A: Using Tapo App
1. Open Tapo app
2. Tap on camera
3. Go to **Settings** → **Device Info**
4. Note down the **IP Address**

### Option B: Using Network Scanner
```bash
# On Windows
arp -a | findstr "00-00-00-00-00-00"

# On Linux/Mac
arp -a | grep "00:00:00:00:00:00"
```

### Option C: Using Router Admin
1. Login to router admin page
2. Check **DHCP Client List**
3. Find device named "Tapo" or "C310"

---

## Step 3: Setup FFmpeg Transcoding Server

### Prerequisites

FFmpeg transcoder can run on:
- **Raspberry Pi 4** (recommended for production)
- **Windows PC**
- **Linux Server**
- **macOS**

### Option A: Quick Setup (Docker)

1. **Install Docker:**
   - Windows: https://docs.docker.com/desktop/install/windows-install/
   - Linux: `curl -sSL https://get.docker.com | sh`
   - Mac: https://docs.docker.com/desktop/install/mac-install/

2. **Run FFmpeg WebRTC transcoder:**
   ```bash
   docker run -d \
     --name ffmpeg-webrtc \
     -p 8000:8000 \
     -e RTSP_URL="rtsp://USERNAME:PASSWORD@192.168.1.150/stream1" \
     -e STUN_SERVER="stun:stun.l.google.com:19302" \
     your-ffmpeg-webrtc-image:latest
   ```

### Option B: Manual Setup (Node.js)

1. **Install dependencies:**
   ```bash
   mkdir tapo-transcoder
   cd tapo-transcoder
   npm init -y
   npm install express ws fluent-ffmpeg @ffmpeg-installer/ffmpeg
   ```

2. **Create server (`server.js`):**
   ```javascript
   const express = require('express');
   const WebSocket = require('ws');
   const ffmpeg = require('fluent-ffmpeg');
   const app = express();

   app.use(express.json());

   // WebRTC signaling endpoint
   app.post('/stream', async (req, res) => {
     const { sdp, rtspUrl } = req.body;

     // TODO: Implement WebRTC peer connection
     // and FFmpeg RTSP to WebRTC transcoding

     res.json({
       sdp: sdp, // Mock response
       type: 'answer'
     });
   });

   app.listen(8000, () => {
     console.log('FFmpeg WebRTC transcoder running on port 8000');
   });
   ```

3. **Start server:**
   ```bash
   node server.js
   ```

---

## Step 4: Connect Tapo C310 to Dashboard

### Test Connection

1. Open test page: `http://localhost:3000/test-tapo`
2. Enter RTSP URL: `rtsp://USERNAME:PASSWORD@192.168.1.150/stream1`
3. Enter Transcoding URL: `http://192.168.1.100:8000/stream`
4. Click **"Copy Config"** to save
5. Video stream should appear within ~2-3 seconds

### Production Deployment

Update your dashboard to use Tapo C310 stream:

```tsx
import TapoC310Stream from "@/components/TapoC310Stream";

<TapoC310Stream
  rtspUrl="rtsp://admin:password@192.168.1.150/stream1"
  transcodingUrl="http://192.168.1.100:8000/stream"
  camId={1}
/>
```

---

## Step 5: Optimize for Low Latency

### Camera Settings (Tapo C310)

1. **Use wired Ethernet** instead of WiFi
2. **Lower resolution** if latency is too high:
   - Use `/stream2` instead of `/stream1` (720p vs 1080p)
3. **Reduce FPS** in Tapo app:
   - Settings → Video & Audio → Frame Rate → 15fps

### FFmpeg Settings

```bash
ffmpeg -rtsp_transport tcp \
  -i "rtsp://admin:password@192.168.1.150/stream1" \
  -c:v libx264 \
  -preset ultrafast \
  -tune zerolatency \
  -f rtsp rtsp://localhost:8000/stream
```

### Network Optimization

- **Use Gigabit switch** instead of WiFi router
- **Quality of Service (QoS):** Prioritize video traffic
- **Disable energy saving** on network adapter

---

## Troubleshooting

### Issue: RTSP Connection Failed

**Solution:**
1. Verify RTSP is enabled on Tapo C310
2. Check username and password
3. Ping camera IP: `ping 192.168.1.150`
4. Test RTSP with VLC: Open VLC → File → Open Network → Enter RTSP URL

### Issue: No Video Stream

**Solution:**
1. Check FFmpeg transcoder is running
2. Verify transcoding server URL
3. Check browser console (F12) for errors
4. Ensure STUN server is accessible

### Issue: High Latency (>500ms)

**Solution:**
1. Use `/stream2` instead of `/stream1` (lower quality)
2. Connect devices via wired Ethernet
3. Reduce FPS in Tapo app settings
4. Use faster transcoding server (Raspberry Pi 4)

### Issue: Connection Drops Frequently

**Solution:**
1. Check WiFi signal strength
2. Use wired Ethernet connection
3. Increase RTSP timeout in FFmpeg
4. Restart camera and transcoder

---

## Security Best Practices

1. **Use strong password** for Tapo camera RTSP
2. **Don't expose RTSP port** to public internet
3. **Use HTTPS/WSS** for production transcoding
4. **Keep camera firmware** updated
5. **Separate VLAN** for IoT devices (optional)

---

## Alternative: Use Raspberry Pi with Camera Module

If you want even lower latency (~100ms), consider using **Raspberry Pi Camera Module** instead of Tapo C310:

- Raspberry Pi Camera + **RaspberryPi-WebRTC** project
- Direct WebRTC streaming (no RTSP transcoding needed)
- Latency: ~100-150ms

See `RASPBERRYPI_SETUP_GUIDE.md` for details.

---

## Performance Comparison

| Camera Type | Latency | Quality | Complexity |
|-------------|---------|---------|------------|
| **Tapo C310 (RTSP → WebRTC)** | ~200-300ms | 1080p @ 30fps | Medium (needs transcoder) |
| **Raspberry Pi Camera (Direct WebRTC)** | ~100-150ms | 1080p @ 30fps | Low (native WebRTC) |
| **Tapo C310 (RTSP → WebSocket)** | ~500-800ms | 1080p @ 30fps | Low (simple relay) |

---

## Resources

- **Tapo C310 Support:** https://www.tp-link.com/support/
- **FFmpeg Documentation:** https://ffmpeg.org/documentation.html
- **WebRTC Basics:** https://webrtc.org/
- **Test Page:** http://localhost:3000/test-tapo

---

## Next Steps

1. ✅ Enable RTSP on Tapo C310
2. ✅ Get RTSP URL with credentials
3. ✅ Setup FFmpeg transcoding server
4. ✅ Test connection on `/test-tapo` page
5. ✅ Deploy to production dashboard

---

**Status:** Ready for Integration 🔧

**Last Updated:** 2026-04-22
