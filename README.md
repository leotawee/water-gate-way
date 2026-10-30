# Water Gate Way

Web dashboard for the Water Gate Way system, built with [Next.js](https://nextjs.org). The repo also holds the supporting pieces: an MQTT bridge, Python scripts, an ESP32-S3 HMI firmware project, and config for camera streaming from a Raspberry Pi.

## Repository layout

- `src/`: Next.js app (`app/`, `components/`, `hooks/`)
- `public/`: static assets
- `mqtt_bridge.js`: Node.js MQTT bridge (`npm run bridge`)
- `python_detection_sender.py`, `ai-receiver/`: Python scripts
- `esp32-s3/`: PlatformIO project for the ESP32-S3 HMI
- `go2rtc.yaml`, `start-pi-webrtc.sh`: video streaming config and startup script

## Architecture

The browser talks only to the Next.js server (behind nginx/TLS). Next.js authenticates every request (scrypt passwords, `wg_session` cookie, roles `viewer` < `operator` < `admin`) and is the only component that reaches the backends, all on loopback or the private network:

- Next.js -> PostgreSQL: users, sessions, `control_audit`.
- Next.js -> Mosquitto (`MQTT_URL`, account `nextjs`): subscribes to the status topics (fanned out to browsers as same-origin SSE at `/api/status/stream`) and publishes operator commands to `stm32/cmd`. Commands from `POST /api/control` go over this connection; the Pi's `cmd_node` executes them. FastAPI/ai-receiver is not in this path.
- Next.js -> go2rtc (`GO2RTC_URL`, private network): `GET /api/camera/stream` proxies go2rtc's live HTTP video (fragmented MP4). No WebRTC, no ICE.

Content-Security-Policy and the other security headers are set in `next.config.ts`.

## Environment variables

Copy `.env.example` to `.env.local`. Values never go in `NEXT_PUBLIC_*`.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `PGUSER` `PGHOST` `PGDATABASE` `PGPASSWORD` `PGPORT` | Next.js, `mqtt_bridge.js` | PostgreSQL connection (app user, least privilege) |
| `MQTT_URL` `MQTT_USERNAME` `MQTT_PASSWORD` | Next.js | Broker account `nextjs`: reads the status topics, writes only `stm32/cmd` |
| `MQTT_TOPIC_STATUS` | Next.js, ai-receiver | Extra status topic to subscribe to |

| `CONTROL_SHARED_SECRET` | ai-receiver (FastAPI) | `X-Control-Token` on its HTTP endpoints; at least 32 chars; it refuses to start without it. The Next.js app no longer uses it |
| `GO2RTC_URL` | Next.js | go2rtc API, must be reachable from the app server |
| `API_HOST` | FastAPI | Bind address, default `127.0.0.1` |
| `MQTT_BROKER` `MQTT_TOPIC` `MQTT_QOS` | `mqtt_bridge.js` | Bridge broker, topic, QoS |
| `MQTT_HOST` `MQTT_PORT` `MQTT_TOPIC_CONTROL` `WGW_SERIAL_PORT` | ai-receiver | Broker, control topic, serial port |

## First-time setup

1. Apply `db/migrations/001_auth.sql` as a DB role with CREATE privilege (it needs the `citext` and `pgcrypto` extensions).
2. Create the app DB user and grant only: `SELECT, INSERT, UPDATE, DELETE` on `users`, `sessions`, `control_audit`, plus `USAGE` on `control_audit_id_seq`.
3. Only if you run ai-receiver: generate its secret with `openssl rand -hex 32` and set `CONTROL_SHARED_SECRET` for it. Give the broker account `nextjs` write access to `stm32/cmd`, or operator commands fail with `device_unavailable`.
4. Create the first admin: `node scripts/create-user.ts <email> <role>` (roles: `viewer`, `operator`, `admin`; Node >= 22.6). There is no public sign-up.
5. `npm install && npm run build && npm run start`.

## Deploy checklist

Containment (do first):

- [ ] **Mosquitto:** do not just bind it to loopback: the Pi's services connect over the network. Follow `docs/superpowers/plans/2026-10-30-broker-lockdown.md` (users, ACL, move the Pi to the Tailscale IP first). ACL for `nextjs`: `read stm32/status/all`, `read water/gate/status`, `write stm32/cmd`. Nobody except `nextjs` and the Pi may publish `stm32/cmd`. Remove the websocket listener.
- [ ] **nginx:** delete the `location /mqtt` and any `location /api/control` or `/ws/` block that proxies to Mosquitto or FastAPI directly. Only `proxy_pass` to Next.js remains.
- [ ] **FastAPI:** run with `host=127.0.0.1` (default via `API_HOST`).
- [ ] **TLS:** `certbot --nginx -d map.hyxc.io` (or a `*.hyxc.io` DNS-01 cert); confirm `systemctl list-timers | grep certbot`.
- [ ] **Verify:** from outside, the WebSocket handshake to `https://map.hyxc.io/mqtt` no longer returns `101`, and `nc -vz map.hyxc.io 1883` and `:8000` fail.
- [ ] **Rotate** the admin password that was pasted into chat on 2026-10-30.

Rebuild-specific:

- [ ] Before sending a real command, confirm the `nextjs` broker account can write `stm32/cmd` and that the Pi's `cmd_node` is running. The app reports `sent` once the broker connection takes the message; delivery is visible in the status stream.
- [ ] nginx must overwrite forwarding headers, not append: `proxy_set_header X-Forwarded-For $remote_addr;`, `proxy_set_header X-Forwarded-Proto $scheme;`, `proxy_set_header X-Forwarded-Host $host;` (rate limiting and the Origin check rely on them).
- [ ] nginx: `location ~ ^/api/(status|camera)/stream$` needs `proxy_buffering off;` and a long `proxy_read_timeout` (SSE and live video).
- [ ] go2rtc: the app server must reach its API (tailnet ACL plus `tailscale serve` on the Pi, never Funnel). Video goes over HTTP through the app, so no TURN server or public WebRTC port is needed.
- [ ] Confirm the response headers from `curl -sI https://map.hyxc.io/login` (HSTS, nosniff, X-Frame-Options, Referrer-Policy, CSP).

## Testing

```bash
npm test
npm run typecheck
npm run lint
ai-receiver/.venv/bin/python -m pytest ai-receiver/test_auth.py
```

## Documentation

- [PI_WEBRTC_RTSP_SETUP_GUIDE.md](PI_WEBRTC_RTSP_SETUP_GUIDE.md): Raspberry Pi 4 pulls the Tapo C310 RTSP stream and serves it over WebRTC using pi-webrtc.
- [RASPBERRYPI_SETUP_GUIDE.md](RASPBERRYPI_SETUP_GUIDE.md): Raspberry Pi 4 setup with TzuHuanTai/RaspberryPi-WebRTC for low-latency video from a CSI or USB camera.
- [MQTT_BRIDGE_SETUP_GUIDE.md](MQTT_BRIDGE_SETUP_GUIDE.md): Video from the Pi reaches the dashboard as Base64 JPEG frames over MQTT.
- [WEBRTC_INTEGRATION_GUIDE.md](WEBRTC_INTEGRATION_GUIDE.md): `<WebRTCPlayer />` component props, usage, and the signaling backend it requires.
- [TAPO_C310_SETUP_GUIDE.md](TAPO_C310_SETUP_GUIDE.md): Tapo C310 RTSP to WebRTC using an FFmpeg transcoder.
- [AGENTS.md](AGENTS.md): Instructions for AI coding agents. This Next.js version has breaking changes, so read the bundled docs in `node_modules/next/dist/docs/` first.
- [CLAUDE.md](CLAUDE.md): Claude Code entry point that imports `AGENTS.md`.
