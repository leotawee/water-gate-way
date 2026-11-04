# Raspberry Pi Setup Guide for Water Gate Way System

## Overview

This guide explains how to set up **Raspberry Pi 4** with the **TzuHuanTai/RaspberryPi-WebRTC** project to stream ultra-low latency video (~200ms) to the Water Gate Way dashboard.

---

## Hardware Requirements

- **Raspberry Pi 4** (4GB+ RAM recommended)
- **CSI or USB Camera** compatible with libcamera
- **MicroSD Card** (16GB+ Class 10)
- **Ethernet cable** or WiFi connection

---

## Software Stack

| Component | Version/Source |
|-----------|----------------|
| **Raspberry Pi OS** | Lite (64-bit) |
| **WebRTC Streamer** | [TzuHuanTai/RaspberryPi-WebRTC](https://github.com/TzuHuanTai/RaspberryPi-WebRTC) |
| **MQTT Broker** | Mosquitto (optional: Cloud MQTT) |
| **Signaling Protocol** | MQTT over WebSocket |

---

## Step 1: Flash Raspberry Pi OS

1. Download **Raspberry Pi Imager**: https://www.raspberrypi.com/software/
2. Use it to flash **Raspberry Pi OS Lite (64-bit)** to SD card
3. Enable **SSH** during imaging (click the gear icon ⚙️)
4. Insert SD card into Pi and power on

---

## Step 2: Install Dependencies

SSH into your Raspberry Pi:

```bash
ssh pi@raspberrypi.local
# Default password: raspberry
```

Update system and install required packages:

```bash
sudo apt update
sudo apt install -y libmosquitto1 pulseaudio libavformat61 libswscale8
```

---

## Step 3: Download RaspberryPi-WebRTC

Get the latest pre-built binary:

```bash
# Download latest release
wget https://github.com/TzuHuanTai/RaspberryPi-WebRTC/releases/latest/download/pi-webrtc_raspios-trixie-arm64.tar.gz

# Extract
tar -xzf pi-webrtc_raspios-trixie-arm64.tar.gz

# Make executable
chmod +x pi-webrtc

# Test run
./pi-webrtc --help
```

---

## Step 4: Setup MQTT Broker

### Option A: Local Mosquitto (Recommended for Development)

1. **Install Mosquitto:**

   ```bash
   sudo apt install -y mosquitto mosquitto-clients
   ```

2. **Configure broker** (`/etc/mosquitto/mosquitto.conf`):

   ```bash
   sudo nano /etc/mosquitto/mosquitto.conf
   ```

   Add this configuration:

   ```conf
   pid_file /run/mosquitto/mosquitto.pid

   persistence true
   persistence_location /var/lib/mosquitto/

   log_dest file /var/log/mosquitto/mosquitto.log

   listener 1883
   allow_anonymous true

   # Enable WebSocket (optional, for web clients)
   listener 8083
   protocol websockets
   ```

3. **Restart service:**

   ```bash
   sudo systemctl restart mosquitto
   sudo systemctl enable mosquitto
   ```

### Option B: Cloud MQTT Broker

Use services like:
- **HiveMQ**: https://www.hivemq.com
- **EMQX**: https://www.emqx.com/en

Get WebSocket URL, username, and password from your cloud provider.

---

## Step 5: Run WebRTC Streamer

### Basic Command (Raspberry Pi 4)

```bash
./pi-webrtc \
  --camera=libcamera:0 \
  --fps=30 \
  --width=1280 \
  --height=960 \
  --use-mqtt \
  --mqtt-host=localhost \
  --mqtt-port=1883 \
  --uid=water-gate-cam-1 \
  --no-audio \
  --hw-accel
```

### For Cloud MQTT Broker

```bash
./pi-webrtc \
  --camera=libcamera:0 \
  --fps=30 \
  --width=1280 \
  --height=960 \
  --use-mqtt \
  --mqtt-host=your.mqtt.cloud \
  --mqtt-port=8883 \
  --mqtt-username=your-username \
  --mqtt-password=your-password \
  --uid=water-gate-cam-1 \
  --no-audio \
  --hw-accel
```

### Command Parameters Explained

| Parameter | Value | Description |
|-----------|-------|-------------|
| `--camera` | `libcamera:0` | Use CSI camera (first camera) |
| `--fps` | `30` | Frames per second |
| `--width` | `1280` | Video width (pixels) |
| `--height` | `960` | Video height (pixels) |
| `--use-mqtt` | - | Enable MQTT signaling |
| `--mqtt-host` | `localhost` or broker URL | MQTT broker address |
| `--mqtt-port` | `1883` (non-TLS) or `8883` (TLS) | MQTT broker port |
| `--mqtt-username` | Optional | MQTT username |
| `--mqtt-password` | Optional | MQTT password |
| `--uid` | `water-gate-cam-1` | Unique camera ID (MUST match frontend) |
| `--no-audio` | - | Disable audio |
| `--hw-accel` | - | Use hardware encoder (Pi 4 only) |

---

## Step 6: Connect Frontend

1. Open the Water Gate Way dashboard: `http://localhost:3000/test-webrtc`
2. Select **"MQTT (RaspberryPi-WebRTC)"** signaling type
3. Configure:
   - **MQTT Broker URL:** `ws://localhost:8083` (local) or `wss://your.mqtt.cloud` (cloud)
   - **Camera UID:** `water-gate-cam-1` (MUST match Pi's `--uid`)
   - **MQTT Username/Password:** If authentication enabled
4. Click **"Copy Config"** to save configuration
5. Video stream should appear within ~2 seconds

---

## Step 7: Run as Linux Service (Auto-start)

Create service file:

```bash
sudo nano /etc/systemd/system/pi-webrtc.service
```

Add this content:

```ini
[Unit]
Description=Pi WebRTC Streamer
After=network.target mosquitto.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pi-webrtc
ExecStart=/home/pi/pi-webrtc/pi-webrtc \
  --camera=libcamera:0 \
  --fps=30 \
  --width=1280 \
  --height=960 \
  --use-mqtt \
  --mqtt-host=localhost \
  --mqtt-port=1883 \
  --uid=water-gate-cam-1 \
  --no-audio \
  --hw-accel
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable pi-webrtc
sudo systemctl start pi-webrtc
sudo systemctl status pi-webrtc
```

---

## Troubleshooting

### Issue: MQTT Connection Failed

**Solution:**
1. Check Mosquitto is running:
   ```bash
   sudo systemctl status mosquitto
   ```
2. Test MQTT connection:
   ```bash
   mosquitto_sub -h localhost -t "picamera/#" -v
   ```
3. Verify firewall allows port 1883 and 8083

### Issue: ICE Connection Failed

**Solution:**
1. Check Pi and frontend are on same network
2. Verify STUN server is accessible
3. Try using different STUN server: `stun:stun1.l.google.com:19302`

### Issue: No Video Stream

**Solution:**
1. Check camera is connected:
   ```bash
   libcamera-hello
   ```
2. Verify Pi has enough memory (4GB+ recommended)
3. Check browser console for errors (F12)

### Issue: High Latency

**Solution:**
1. Use wired Ethernet instead of WiFi
2. Reduce resolution: `--width=640 --height=480`
3. Reduce FPS: `--fps=15`
4. Ensure hardware acceleration is enabled: `--hw-accel`

---

## MQTT Topics Reference

The frontend and backend exchange data via these MQTT topics:

| Topic | Direction | Payload |
|-------|-----------|---------|
| `picamera/{uid}/offer` | Frontend → Pi | SDP Offer |
| `picamera/{uid}/answer` | Pi → Frontend | SDP Answer |
| `picamera/{uid}/ice` | Bidirectional | ICE Candidates |

Replace `{uid}` with your camera UID (e.g., `water-gate-cam-1`).

---

## Performance Optimization

### For Low Latency (~200ms)

- ✅ Use Raspberry Pi 4 (4GB+ RAM)
- ✅ Enable hardware encoding: `--hw-accel`
- ✅ Use wired Ethernet connection
- ✅ Reduce resolution to 720p: `--width=1280 --height=720`
- ✅ Set FPS to 30: `--fps=30`
- ✅ Use local MQTT broker (same network as Pi)

### For High Quality

- ✅ Increase resolution to 1080p: `--width=1920 --height=1080`
- ✅ Set FPS to 60: `--fps=60`
- ✅ Ensure Pi has adequate cooling

---

## Security Best Practices

1. **Enable MQTT Authentication:**
   ```conf
   # /etc/mosquitto/mosquitto.conf
   allow_anonymous false
   password_file /etc/mosquitto/passwd
   ```

2. **Use TLS for Cloud MQTT:**
   - Use port `8883` instead of `1883`
   - Set `--mqtt-port=8883` in pi-webrtc command

3. **Limit Camera Access:**
   - Use unique UID for each camera
   - Don't expose MQTT broker to public internet

---

## Resources

- **RaspberryPi-WebRTC GitHub:** https://github.com/TzuHuanTai/RaspberryPi-WebRTC
- **Mosquitto Documentation:** https://mosquitto.org/documentation/
- **Water Gate Way Test Page:** http://localhost:3000/test-webrtc

---

## Next Steps

1. ✅ Install Mosquitto MQTT broker on Pi
2. ✅ Download and configure pi-webrtc
3. ✅ Test connection using frontend test page
4. ✅ Configure as Linux service for auto-start
5. ✅ Deploy multiple cameras with unique UIDs

---

**Status:** Ready for Hardware Team Deployment 🔧

**Last Updated:** 2026-04-22
