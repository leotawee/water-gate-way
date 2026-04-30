# MQTT Bridge Setup Guide for Water Gate Way System

## Overview

This guide explains how to setup **MQTT-based video streaming** from Raspberry Pi to the Water Gate Way dashboard. This approach is **simple, reliable, and compatible** with any hardware setup.

---

## System Architecture

```
┌──────────────┐      RTSP       ┌─────────────┐      Publish      ┌──────────────┐
│              │ ─────────────────> │             │ ──────────────────> │              │
│  Tapo C310   │   rtsp://user:pass  │  Raspberry  │   Base64 JPEG      │   MQTT       │
│   Camera     │                     │     Pi      │                     │   Broker     │
│              │                     │  (Python)   │                     │  178.128.49. │
└──────────────┘                     └─────────────┘                     └──────────────┘
                                                                          │
                                                                          │ Subscribe
                                                                          ▼
                                                                    ┌──────────────┐
                                                                    │              │
                                                                    │   Browser    │
                                                                    │  Dashboard   │
                                                                    │              │
                                                                    └──────────────┘

Latency: ~200-500ms
Quality: 640x480 @ 15fps
Reliability: ⭐⭐⭐⭐⭐ (Very High)
```

---

## Hardware Requirements

- **Raspberry Pi** (any model with network)
- **Tapo C310 Camera** with RTSP enabled
- **Internet connection** (for MQTT broker access)

---

## Software Requirements

- **Python 3** on Raspberry Pi
- **OpenCV** (cv2)
- **Paho-MQTT** library
- **MQTT.js** on frontend (already installed)

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

### Test RTSP Stream with VLC

1. Open **VLC Media Player**
2. File → Open Network
3. Enter RTSP URL: `rtsp://admin:YOUR_PASSWORD@192.168.1.150/stream1`
4. Click **Play**
5. Video should appear within ~2 seconds

---

## Step 2: Setup Raspberry Pi

### SSH into Raspberry Pi

```bash
ssh pi@192.168.1.151
# Default password: raspberry
```

### Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### Install Python Dependencies

```bash
# Install pip and OpenCV
sudo apt install -y python3-pip python3-opencv python3-dev

# Install MQTT library
pip3 install paho-mqtt

# Verify installations
python3 -c "import cv2; print('OpenCV:', cv2.__version__)"
python3 -c "import paho.mqtt; print('Paho-MQTT:', paho.mqtt.__version__)"
```

---

## Step 3: Deploy Camera Publisher Script

### Copy Script to Raspberry Pi

**Option A: Using SCP**
```bash
# On your PC
scp camera_publisher.py pi@192.168.1.151:~/
```

**Option B: Create directly on Pi**
```bash
# SSH into Pi
ssh pi@192.168.1.151

# Create script
nano ~/camera_publisher.py
```

Paste the script content and save (Ctrl+X, Y, Enter).

### Make Script Executable

```bash
chmod +x ~/camera_publisher.py
```

---

## Step 4: Configure Script

### Edit Configuration

```bash
nano ~/camera_publisher.py
```

Update these variables:

```python
# RTSP URL of Tapo C310 camera
RTSP_URL = "rtsp://admin:YOUR_PASSWORD@192.168.1.150/stream1"

# MQTT Broker settings
MQTT_BROKER = "178.128.49.254"
MQTT_PORT = 1883
MQTT_TOPIC = "gate/camera/stream"

# Video settings
FPS = 15
JPEG_QUALITY = 80
FRAME_WIDTH = 640
FRAME_HEIGHT = 480
```

---

## Step 5: Run Camera Publisher

### Manual Start (Testing)

```bash
cd ~
python3 camera_publisher.py
```

### Expected Output

```
==================================================
🎬 Water Gate Way - Camera Publisher
==================================================
📹 RTSP Source: rtsp://admin:****@192.168.1.150/stream1
🌐 MQTT Broker: 178.128.49.254:1883
📡 MQTT Topic: gate/camera/stream
🎥 Resolution: 640x480 @ 15fps
==================================================
🔗 Connecting to MQTT broker 178.128.49.254:1883...
✅ Connected to MQTT broker: 178.128.49.254:1883
📹 Opening RTSP stream: rtsp://admin:****@192.168.1.150/stream1
✅ RTSP stream opened successfully
📸 Publishing frames to MQTT... (Press 'q' to quit)
📊 FPS: 15.0 | Frames: 15 | Size: 12345 bytes
📊 FPS: 15.0 | Frames: 30 | Size: 12456 bytes
...
```

### Command Line Arguments

```bash
# Custom RTSP URL
python3 camera_publisher.py --rtsp "rtsp://admin:pass@192.168.1.150/stream1"

# Custom broker
python3 camera_publisher.py --broker "178.128.49.254" --port 1883

# Custom topic
python3 camera_publisher.py --topic "gate/camera/stream"

# Adjust quality and resolution
python3 camera_publisher.py --quality 90 --width 1280 --height 720 --fps 30

# Run without preview window
python3 camera_publisher.py --no-display
```

---

## Step 6: Test Connection from Dashboard

### Open Test Page

1. Open Water Gate Way dashboard: `http://localhost:3000/test-mqtt`
2. Verify configuration:
   - **MQTT Broker URL:** `mqtt://178.128.49.254:1883`
   - **MQTT Topic:** `gate/camera/stream`
   - **Camera ID:** `1`
3. Click **"Copy Config"** if needed

### Verify Video Stream

1. Make sure Python script is running on Pi
2. Open browser console (F12) → Network tab
3. Look for MQTT connection messages
4. Video should appear within ~1 second

### Expected Dashboard Output

```
📹 Camera 1: Connecting to MQTT Broker...
🌐 Broker: mqtt://178.128.49.254:1883
📡 Topic: gate/camera/stream
✅ Camera 1: MQTT Connected to mqtt://178.128.49.254:1883
📥 Camera 1: Subscribed to gate/camera/stream
📊 FPS: 15
```

---

## Step 7: Auto-start on Boot (Optional)

### Create Systemd Service

```bash
sudo nano /etc/systemd/system/camera-publisher.service
```

Add this content:

```ini
[Unit]
Description=Water Gate Way Camera Publisher
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi
ExecStart=/usr/bin/python3 /home/pi/camera_publisher.py --no-display
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable camera-publisher
sudo systemctl start camera-publisher
sudo systemctl status camera-publisher
```

### Service Management

```bash
# Check status
sudo systemctl status camera-publisher

# View logs
journalctl -u camera-publisher -f

# Restart service
sudo systemctl restart camera-publisher

# Stop service
sudo systemctl stop camera-publisher
```

---

## Performance Optimization

### For Lowest Latency (~200ms)

1. **Use wired Ethernet** for Pi and camera
2. **Reduce resolution:** `640x480` or `320x240`
3. **Lower JPEG quality:** `--quality 60`
4. **Reduce FPS:** `--fps 10`
5. **Use local MQTT broker** instead of cloud

### For Best Quality

1. **Increase resolution:** `--width 1280 --height 720`
2. **Higher JPEG quality:** `--quality 90`
3. **Higher FPS:** `--fps 30`
4. **Use wired Ethernet**

### Balance Settings

```bash
# Good balance (recommended)
python3 camera_publisher.py \
  --width 640 \
  --height 480 \
  --fps 15 \
  --quality 80
```

---

## Troubleshooting

### Issue: MQTT Connection Failed

**Solution:**
1. Check broker is reachable:
   ```bash
   ping 178.128.49.254
   ```
2. Test MQTT connection:
   ```bash
   # Install mosquitto clients
   sudo apt install mosquitto-clients

   # Test subscribe
   mosquitto_sub -h 178.128.49.254 -t "gate/camera/stream" -v
   ```
3. Check firewall allows port 1883

### Issue: RTSP Connection Failed

**Solution:**
1. Test RTSP URL with VLC
2. Check camera is reachable:
   ```bash
   ping 192.168.1.150
   ```
3. Verify RTSP URL format:
   ```
   rtsp://USERNAME:PASSWORD@192.168.1.150/stream1
   ```

### Issue: Low FPS

**Solution:**
1. Check Pi CPU usage:
   ```bash
   top -p $(pgrep -f camera_publisher)
   ```
2. Reduce resolution or quality
3. Use Pi 4 instead of Pi 3/Zero
4. Check network bandwidth

### Issue: No Video on Dashboard

**Solution:**
1. Verify Python script is running
2. Check topic matches: `gate/camera/stream`
3. Open browser console (F12) for errors
4. Verify broker URL is correct: `mqtt://178.128.49.254:1883`

### Issue: High Latency (>500ms)

**Solution:**
1. Use wired Ethernet
2. Reduce resolution/quality
3. Check network congestion
4. Use local MQTT broker

---

## Monitoring

### View Script Logs

```bash
# Real-time logs
journalctl -u camera-publisher -f

# Last 50 lines
journalctl -u camera-publisher -n 50

# Check for errors
journalctl -u camera-publisher | grep -i error
```

### Monitor MQTT Messages

```bash
# Subscribe to topic
mosquitto_sub -h 178.128.49.254 -t "gate/camera/stream" -v

# Should see Base64 data streaming
```

### Monitor Pi Resources

```bash
# CPU usage
top -p $(pgrep -f camera_publisher)

# Memory usage
free -h

# Network connection
netstat -tuln | grep 1883
```

---

## Security Best Practices

1. **Use strong password** for Tapo camera RTSP
2. **Encrypt MQTT connection** (use TLS/WSS):
   ```python
   # In Python script
   client.tls_set()
   client.connect(args.broker, 8883, 60)
   ```
3. **Limit MQTT access** with username/password
4. **Monitor broker logs** for suspicious activity
5. **Keep Python script updated**

---

## Testing Checklist

Before deploying to production:

- [ ] RTSP stream works in VLC
- [ ] Python script runs without errors
- [ ] MQTT connection successful
- [ ] Video appears on dashboard
- [ ] FPS is acceptable (>10 fps)
- [ ] Latency is acceptable (<500ms)
- [ ] Auto-start works (if enabled)
- [ ] Error handling works (disconnect camera, etc.)

---

## Alternative: Multiple Cameras

### Run Multiple Instances

```bash
# Camera 1
python3 camera_publisher.py \
  --rtsp "rtsp://admin:pass@192.168.1.150/stream1" \
  --topic "gate/camera/stream/1" &

# Camera 2
python3 camera_publisher.py \
  --rtsp "rtsp://admin:pass@192.168.1.151/stream1" \
  --topic "gate/camera/stream/2" &

# Camera 3
python3 camera_publisher.py \
  --rtsp "rtsp://admin:pass@192.168.1.152/stream1" \
  --topic "gate/camera/stream/3" &
```

### Create Multiple Services

```bash
# Camera 1
sudo cp /etc/systemd/system/camera-publisher.service \
        /etc/systemd/system/camera-publisher-1.service

# Edit ExecStart line to use different RTSP URL and topic
```

---

## Resources

- **Paho-MQTT Python:** https://www.eclipse.org/paho/index.php?page=clients/python/index.php
- **OpenCV Python:** https://docs.opencv.org/4.x/d6/d00/tutorial_py_root.html
- **MQTT Protocol:** https://mqtt.org/
- **Test Page:** http://localhost:3000/test-mqtt

---

## Next Steps

1. ✅ Enable RTSP on Tapo C310
2. ✅ Install Python dependencies on Pi
3. ✅ Deploy camera_publisher.py script
4. ✅ Test connection on /test-mqtt page
5. ✅ Optimize for performance
6. ✅ Setup auto-start (optional)
7. ✅ Deploy to production

---

**Status:** Ready for Production 🚀

**Last Updated:** 2026-04-22
