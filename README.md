# Water Gate Way

Web dashboard for the Water Gate Way system, built with [Next.js](https://nextjs.org). The repo also holds the supporting pieces: an MQTT bridge, Python scripts, an ESP32-S3 HMI firmware project, and config for camera streaming from a Raspberry Pi.

## Repository layout

- `src/`: Next.js app (`app/`, `components/`, `hooks/`)
- `public/`: static assets
- `mqtt_bridge.js`: Node.js MQTT bridge (`npm run bridge`)
- `python_detection_sender.py`, `ai-receiver/`: Python scripts
- `esp32-s3/`: PlatformIO project for the ESP32-S3 HMI
- `go2rtc.yaml`, `start-pi-webrtc.sh`: video streaming config and startup script

## Quick start

Requires Node.js and npm (the repo includes `package-lock.json`).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other scripts from `package.json`: `npm run build`, `npm run start`, `npm run lint`, `npm run bridge`.

## Documentation

- [PI_WEBRTC_RTSP_SETUP_GUIDE.md](PI_WEBRTC_RTSP_SETUP_GUIDE.md): Raspberry Pi 4 pulls the Tapo C310 RTSP stream and serves it over WebRTC using pi-webrtc.
- [RASPBERRYPI_SETUP_GUIDE.md](RASPBERRYPI_SETUP_GUIDE.md): Raspberry Pi 4 setup with TzuHuanTai/RaspberryPi-WebRTC for low-latency video from a CSI or USB camera.
- [MQTT_BRIDGE_SETUP_GUIDE.md](MQTT_BRIDGE_SETUP_GUIDE.md): Video from the Pi reaches the dashboard as Base64 JPEG frames over MQTT.
- [WEBRTC_INTEGRATION_GUIDE.md](WEBRTC_INTEGRATION_GUIDE.md): `<WebRTCPlayer />` component props, usage, and the signaling backend it requires.
- [TAPO_C310_SETUP_GUIDE.md](TAPO_C310_SETUP_GUIDE.md): Tapo C310 RTSP to WebRTC using an FFmpeg transcoder.
- [AGENTS.md](AGENTS.md): Instructions for AI coding agents. This Next.js version has breaking changes, so read the bundled docs in `node_modules/next/dist/docs/` first.
- [CLAUDE.md](CLAUDE.md): Claude Code entry point that imports `AGENTS.md`.
