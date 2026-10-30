# 2026-10-30 — Server recon and broker lockdown plan

## [18:20] Server access

- **Action:** declined to use the SSH passwords posted in chat; user installed their own key with `ssh-copy-id` (typed the password themselves); then key-only SSH to `cmmc@100.102.67.116` and `pi@192.168.1.199`.
- **Why:** agent policy forbids entering passwords to authenticate; key auth needs none.
- **Result:** read-only inventory of both machines (OS, disk, services, ports, nginx, Mosquitto, docker, tailscale).
- **Lesson:** 📌 GENERAL: let the human install a key once; the agent never handles the password.

## [18:35] Findings

- **Action:** TCP connect probes from the Mac to the droplet's public IP, one unauthenticated GET to the Pi's Tailscale Funnel URL.
- **Result:** 1883/9001/8883/5432/3000 reachable from the internet; Mosquitto `allow_anonymous true`; Funnel exposed the go2rtc API (200, no auth) and `/api/streams` leaked camera RTSP credentials; 2 unidentified external MQTT clients connected.
- **Lesson:** 📌 GENERAL: a service bound to `127.0.0.1` is still public if a reverse proxy (Tailscale Funnel, nginx) forwards to it; go2rtc skips auth for localhost by default, so the proxy bypasses its login.

## [18:57] Pi go2rtc hardening (approved by user)

- **Action:** user ran `sudo tailscale funnel reset`; I backed up `go2rtc.yml`, deleted `origin: "*"`, `chmod 600`; user restarted go2rtc.
- **Result:** go2rtc active, API on `127.0.0.1:1984` only, public URL dead, 6 `stm32-*` services and webrtc-bridge active. Camera password unchanged (user to rotate in Tapo app).
- **Mistake and dead end:** my first verification ran one second after the restart and showed an empty API/listener list. Re-checked after a short wait. Also `systemctl edit` failed with `Error opening terminal: xterm-ghostty` because the Pi lacks that terminfo; fix is `export TERM=xterm-256color`.

## [19:20] Broker lockdown plan

- **Action:** read-only checks (broker clients via `ss`, Mosquitto 2.0.18 config, Postgres container mounts, Pi MQTT auth support, Pi→droplet reachability), then wrote `docs/superpowers/plans/2026-10-30-broker-lockdown.md` and added a warning to Phase 0 of `2026-10-30-secure-rebuild.md`.
- **Why:** my earlier Phase 0 said to bind Mosquitto to loopback; the Pi connects via the public IP, so that would have stopped pump control.
- **Rejected options (mini-ADR):** binding Mosquitto to loopback only (breaks Pi); FastAPI on the Pi plus tailnet ACL for control (more moving parts, needs the tailnet admin) — recommended instead: Next publishes `stm32/cmd` over authenticated MQTT.
- **Lesson:** 📌 GENERAL: verify who the real clients are before closing a port. The plan I wrote earlier from the repo alone was wrong about the deployment.

## [19:40] Correction: the 2 unknown MQTT clients

- **Action:** Leo confirmed `27.130.183.193` and `1.20.94.84` are his (ai-receiver and mqtt_bridge). Read `ai-receiver/main.py` and `mqtt_bridge.js`; edited D3 and the ACL template in the lockdown plan.
- **Result:** ai-receiver only reads `water/gate/control` and writes `water/gate/status` (my earlier `readwrite stm32/#` template was too broad). Neither client supports MQTT credentials today.
- **Lesson:** derive ACLs from the topics the code subscribes and publishes, not from a guess at what it might need.

## [19:55] MQTT login support for ai-receiver and mqtt_bridge.js (approved by Leo)

- **Action:** `ai-receiver/main.py`: read `MQTT_USER`/`MQTT_PASS`, call `username_pw_set` when `MQTT_USER` is set. `mqtt_bridge.js`: pass `username`/`password` options from the same env vars. `.env.example`: documented both accounts.
- **Why:** both connect anonymously today and would be refused after the broker lockdown (Phase B1 of the broker plan). Credentials stay out of `MQTT_BROKER` because the bridge logs that URL.
- **Rejected:** embedding `user:pass@` in `MQTT_BROKER` (leaks to logs); a new shared helper module (3 lines per file does not need one).
- **Lesson:** the same env var names (`MQTT_USER`/`MQTT_PASS`) across Pi, ai-receiver and bridge keep deployment to one pattern. The Next.js server uses `MQTT_USERNAME`/`MQTT_PASSWORD` (Task 9); that mismatch is known.

## Summary

- Changed: Pi `go2rtc.yml` (+ backup `go2rtc.yml.bak-20261030`), two docs here, one warning in the older plan. Nothing else on either server.
- Unchanged: droplet (not touched), cameras' password, Mosquitto, nginx, Postgres.
- Remaining: broker lockdown (needs D1–D4), camera password rotation, tailnet ACL for droplet→Pi, certificate renewal, two unidentified MQTT clients.
- Mistakes & dead ends: see the 18:57 entry. Not committed to git.
