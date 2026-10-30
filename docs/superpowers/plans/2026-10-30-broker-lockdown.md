# Broker and Network Exposure Lockdown Plan

> Scope: droplet `178.128.49.254` (map.hyxc.io, Tailscale `100.102.67.116`) and the Pi `water` (`192.168.1.199`, Tailscale `100.90.199.55`).
> Supersedes the Mosquitto and nginx bullets of "Phase 0" in `2026-10-30-secure-rebuild.md`. Doing Phase 0 literally (bind Mosquitto to loopback) would cut the Pi off and stop pump control.
> Legend: **[U]** you run it (sudo or DO dashboard). **[C]** Claude: read-only checks, or non-sudo edits after your explicit OK.
> Status: nothing in this plan has been executed. No change was made to either server by writing it.

## Verified facts (2026-10-30, read-only)

| # | Fact | Evidence |
|---|------|----------|
| 1 | Mosquitto 2.0.18 has listeners 1883 (mqtt), 9001 (websockets), 8883 (TLS) and `allow_anonymous true`. No `password_file`, no `acl_file`. An unused `/etc/mosquitto/passwd` (118 B) exists. | `/etc/mosquitto/conf.d/default.conf` |
| 2 | TCP connects from the internet succeed on 22, 1883, 3000, 5432, 8883, 9001. | `nc -z` from the Mac |
| 3 | Established on 1883 now: 6 from `182.232.119.207` (matches the Pi's 6 services), 1 on 9001 from the same IP, and **2 unidentified**: `27.130.183.193`, `1.20.94.84`. | `ss -tn` on the droplet |
| 4 | The 6 Pi services connect to `MQTT_HOST=178.128.49.254:1883`. All their Python entry points already support `MQTT_USER`/`MQTT_PASS` (`username_pw_set`). Installed units set `MQTT_USER` only for dashboard-rx, dashboard-tx, trace-node. | `/home/pi/stm32_bridge`, `systemctl cat` |
| 5 | Pi to droplet TCP 1883 via the Tailscale IP works. Droplet to Pi TCP does not (tailnet ACL, Pi is a shared device). | `nc -zv` both ways |
| 6 | Postgres `watergate-postgres` is published on `0.0.0.0:5432`, volume `watergate_db_data`, `restart=no`. `water-db` is not published. | `docker inspect` |
| 7 | `next start -p 3000` listens on `*:3000`. nginx `default` proxies `/`→3000, `/mqtt`→`127.0.0.1:9001`, `/ws/`→`127.0.0.1:8000`, `/api/control`→`127.0.0.1:8000`. Nothing listens on 8000. No `X-Forwarded-For` is set. | `ss -tln`, `/etc/nginx/sites-enabled/default` |
| 8 | The only project process on the droplet is `next-server`. No MQTT subscriber runs there except browsers. RAM 1 GB (560 MB used). | `ps`, `free` |
| 9 | Topics the Pi code uses: `stm32/cmd`, `stm32/cmd/raw`, `stm32/status/{all,raw,json}`, `stm32/sensor/{pzem,radar,float,wirebreak}`, `stm32/output/pump`, `stm32/alarm`, `water/gate/{status,control}`. | grep of Pi code |

## Decisions needed before the window

- **D1. Control path in production.** The rebuilt `/api/control` forwards to FastAPI over HTTP. In this deployment there is no FastAPI on the droplet, and the droplet cannot reach the Pi's TCP ports. Options:
  - **A.** Run FastAPI on the Pi and get the tailnet admin to allow droplet→Pi. More moving parts.
  - **B (recommended).** `forwardCommand` publishes `stm32/cmd` over authenticated MQTT from the Next server. The Pi's `cmd_node` already consumes that topic. The allowlist stays in Next. Needs a small change on the rebuild branch (one file plus tests).
- **D2. Maintenance window.** The Pi loses the broker for a few seconds. Know what the STM32 does when commands stop (fail-safe state of pumps is not verified). Put pumps in a safe state first.
- **D3. The 2 other clients** (`27.130.183.193`, `1.20.94.84`) are the owner's (confirmed by Leo, 2026-10-30). They connect anonymously today, so Phase B1 will refuse them. Leo says they are `ai-receiver` and `mqtt_bridge.js` (which IP is which is not yet known). Each needs its own broker user (A3) and the ACL block below (A4) before B1. **Neither supports credentials today** (`mqtt.Client()` with no `username_pw_set` at `ai-receiver/main.py:187`; `mqtt.connect(MQTT_BROKER, {...})` with no username/password at `mqtt_bridge.js:154`), so each needs a small code change reading `MQTT_USER`/`MQTT_PASS` (same names as the Pi services), and the new file must be deployed to the machine that runs it. Do not put credentials inside `MQTT_BROKER`: the bridge logs that URL (lines 164 and 255). ACLs, from the topics the code actually uses:
  ```
  user ai_receiver            # ai-receiver/main.py: subscribes control, publishes status
  topic read  water/gate/control
  topic write water/gate/status

  user bridge                 # mqtt_bridge.js (DB writer, read-only)
  topic read stm32/status/all
  topic read watergate/telemetry
  ```
- **D4. Deploying the rebuilt app** to the droplet is a prerequisite of Phase B (the old front end needs the anonymous WebSocket). Build on the Mac (1 GB RAM will not build Next); rsync `.next`, `package.json`, lockfile, `public`, `next.config.ts`; `npm ci --omit=dev` on the droplet. Needs the DB migration, an admin user and the env vars from `.env.example`. Separate runbook.

## Phase A: prepare (no outage)

- [ ] **A1 [U]** Backups on the droplet:
```bash
sudo cp -a /etc/mosquitto /etc/mosquitto.bak-20261030
docker exec watergate-postgres pg_dumpall -U postgres | gzip > ~/pg-backup-20261030.sql.gz && chmod 600 ~/pg-backup-20261030.sql.gz
```
  (Adjust the Postgres user if it is not `postgres`.)
- [ ] **A2 [U]** List existing broker users (names only) so nothing is overwritten:
```bash
sudo cut -d: -f1 /etc/mosquitto/passwd
```
- [ ] **A3 [U]** Create broker users. **No `-c`** (that would erase existing users). Each prompts twice, no echo. Use letters and digits only, 24+ chars (`openssl rand -hex 16`):
```bash
sudo mosquitto_passwd /etc/mosquitto/passwd pi_gate
sudo mosquitto_passwd /etc/mosquitto/passwd nextjs
```
- [ ] **A4 [U]** Create `/etc/mosquitto/acl`:
```
user pi_gate
topic readwrite stm32/#
topic readwrite water/#

user nextjs
topic read  stm32/status/all
topic read  water/gate/status
topic write stm32/cmd
```
  (`nextjs` write on `stm32/cmd` only if D1=B.)
- [ ] **A5 [U]** Stage the new broker config (do not activate yet) as `/etc/mosquitto/conf.d/secure.conf.staged`:
```
listener 1883 127.0.0.1
listener 1883 100.102.67.116
allow_anonymous false
password_file /etc/mosquitto/passwd
acl_file /etc/mosquitto/acl
```
  The 9001 and 8883 listeners are dropped. Add a drop-in so Mosquitto starts after Tailscale: `sudo systemctl edit mosquitto` → `[Unit]` `After=tailscaled.service`. (If your terminal is Ghostty, run `export TERM=xterm-256color` first.)
- [ ] **A6 [U]** Pi: write the drop-ins for all 6 units, **do not restart yet**. The password is read silently and never lands in shell history:
```bash
read -rs -p "pi_gate password: " P; echo
for u in stm32-serial-bridge stm32-cmd-node stm32-status-node stm32-dashboard-rx stm32-dashboard-tx stm32-trace-node; do
  sudo mkdir -p /etc/systemd/system/$u.service.d
  printf '[Service]\nEnvironment="MQTT_HOST=100.102.67.116"\nEnvironment="MQTT_USER=pi_gate"\nEnvironment="MQTT_PASS=%s"\n' "$P" \
    | sudo tee /etc/systemd/system/$u.service.d/mqtt.conf >/dev/null
  sudo chmod 600 /etc/systemd/system/$u.service.d/mqtt.conf
done; unset P
sudo systemctl daemon-reload
```
- [ ] **A7 [C]** Read the full nginx `default` file (including the `/dashboard/` block I have not seen) and draft the exact diff for your approval.

## Phase B: cutover (inside the maintenance window, about 10 minutes)

- [ ] **B1 [U]** Activate the broker config and restart Mosquitto. All clients drop here, including the Pi:
```bash
sudo mv /etc/mosquitto/conf.d/default.conf /etc/mosquitto/default.conf.old
sudo mv /etc/mosquitto/conf.d/secure.conf.staged /etc/mosquitto/conf.d/secure.conf
sudo systemctl restart mosquitto && systemctl is-active mosquitto
```
- [ ] **B2 [U]** Immediately restart the 6 Pi services so they reconnect with credentials over Tailscale:
```bash
sudo systemctl restart stm32-serial-bridge stm32-cmd-node stm32-status-node stm32-dashboard-rx stm32-dashboard-tx stm32-trace-node
```
- [ ] **B3 [C]** Verify: the 6 Pi services are `active`, and the droplet shows 6 established connections from `100.90.199.55` (`ss`), none from public IPs.
- [ ] **B4 [U]** Deploy the rebuilt app with `MQTT_URL=mqtt://127.0.0.1:1883`, `MQTT_USERNAME=nextjs`, `MQTT_PASSWORD=...` (D4).

## Phase C: close the perimeter

- [ ] **C1 [U]** Next listens on loopback only: in `water-gate.service` set `Environment=HOSTNAME=127.0.0.1`, then `sudo systemctl daemon-reload && sudo systemctl restart water-gate`.
- [ ] **C2 [U]** nginx (after A7): remove the `/mqtt`, `/ws/`, `/api/control` locations; add to the `/` location `proxy_set_header X-Forwarded-For $remote_addr;` (overwrite, not append), `X-Forwarded-Proto $scheme`, `X-Forwarded-Host $host`; add a `/api/status/stream` location with `proxy_buffering off`. Then `sudo nginx -t && sudo systemctl reload nginx`.
- [ ] **C3 [U]** Postgres. Fast: DigitalOcean cloud firewall (C4). Permanent: recreate the container with `-p 127.0.0.1:5432:5432` on the same volume `watergate_db_data`, after A1. Needs the original `docker run` env (it holds the DB password, so only you read it). Stopgap until then: `sudo iptables -I DOCKER-USER -i eth0 -p tcp --dport 5432 -j DROP` (not persistent).
- [ ] **C4 [U]** DigitalOcean → Networking → Firewalls: inbound 80 and 443 from anywhere; 22 from your own IP only; everything else denied. Attach to the droplet.
- [ ] **C5 [U]** Turn off SSH password login on both machines, only after testing key login from a second terminal: `PasswordAuthentication no` in `/etc/ssh/sshd_config`, then `sudo systemctl reload ssh`.

## Phase D: verify (Claude, from the Mac, read-only)

- [ ] `nc -z -w3 178.128.49.254 {1883,9001,8883,5432,3000}` → all closed. 443 open. 22 only if your IP is allowed.
- [ ] `curl -s -o /dev/null -w '%{http_code}' https://map.hyxc.io/api/status/stream` → 401 without a session.
- [ ] On the droplet: `ss -tln` shows no listener on `0.0.0.0` except 80, 443 (and 22 if kept).
- [ ] Pi: 6 services active; broker log (needs sudo, you run `sudo tail`) shows no repeated "not authorised" from known clients.
- [ ] Anonymous connection test on the droplet: `mosquitto_sub -h 127.0.0.1 -t test/none -W 2` → "not authorised". Use a harmless topic, never `stm32/cmd`.

## Rollback

- Broker: `sudo rm /etc/mosquitto/conf.d/secure.conf && sudo mv /etc/mosquitto/default.conf.old /etc/mosquitto/conf.d/default.conf && sudo systemctl restart mosquitto`.
- Pi: `sudo rm /etc/systemd/system/stm32-*.service.d/mqtt.conf && sudo systemctl daemon-reload && sudo systemctl restart <the 6 units>`. The units fall back to `178.128.49.254:1883` anonymous.
- DO firewall: detach it from the droplet.

## Residual risk after this plan

- The Pi still trusts the tailnet ACL. MQTT over Tailscale is encrypted by WireGuard, so plain 1883 on the Tailscale IP is acceptable.
- RTSP `8554` is open to the LAN without login on the Pi. Camera password rotation and the `CAM_PASS` change are tracked separately.
- The TLS certificate is a manual file, not certbot-managed. It needs a renewal procedure.
- Fail-safe behaviour of the STM32/pumps on loss of commands is unverified (D2).
