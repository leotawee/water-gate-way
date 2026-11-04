# Pi and droplet: close the open broker and tidy the Pi

> Status: **nothing here has been executed.** Writing this changed no machine.
> Legend: **[U]** you run it (needs `sudo`, or is your decision). **[R]** read-only check, anyone can run it.
> Placeholders (no internal address belongs in this repo, see `docs/IDEA.md`): `<DROPLET_TAILNET_IP>`, `<PI_TAILNET_IP>`, `<DROPLET_PUBLIC_IP>`.
> Builds on `docs/superpowers/plans/2026-10-30-broker-lockdown.md`. That plan predates two changes: the hosts now sit on the owner's own tailnet, and the web app is reached through a Cloudflare tunnel, so its nginx `/mqtt` route no longer exists.

## Why (verified 2026-11-04)

- A credential-less MQTT CONNECT to `<DROPLET_PUBLIC_IP>:1883` from the internet is accepted (CONNACK 0). Ports 1883, 9001 and 8883 are reachable. Anyone can publish `stm32/cmd` and drive the pumps and the siren.
- `/etc/mosquitto/conf.d/default.conf` sets `allow_anonymous true` on 1883 and 9001. `/etc/mosquitto/secure.conf.staged` is written but not applied: listeners on loopback and the tailnet address, `allow_anonymous false`, a password file and an ACL file.
- Six Pi services already connect over the tailnet as user `pi_gate`. One Pi service, `webrtc-bridge`, connects to `ws://<DROPLET_PUBLIC_IP>:9001` with no credentials.

## Ordering rule

**Never close the old listeners or switch off anonymous access before every Pi client uses a tailnet address and credentials.** Otherwise the Pi can no longer command the pumps.

## Steps

### 1. Back up [U]
```bash
sudo mkdir -p /root/mosquitto-backup && sudo cp -a /etc/mosquitto /root/mosquitto-backup/$(date +%F)
```
Expected: the directory exists. Rollback for steps 4-6 is copying it back and `sudo systemctl restart mosquitto`.

### 2. Read the ACL and the user list [U]
`/etc/mosquitto/acl` and `/etc/mosquitto/passwd` are root-only (an unprivileged read gave "Permission denied"):
```bash
sudo cat /etc/mosquitto/acl; sudo cut -d: -f1 /etc/mosquitto/passwd
```
Confirm these accounts and topics exist, and add what is missing before step 5:

| Account | Needs |
|---|---|
| `nextjs` (web app) | write `stm32/cmd`; read `stm32/status/all`, `water/gate/person` |
| `pi_gate` (six Pi services) | read and write `stm32/#`, `tank/#`, `pump/cmd`, `relay/cmd`, `mode/cmd` |
| a new account for `webrtc-bridge` (for example `pi_webrtc`) | read `webrtc/offer/+`, `webrtc/ice/browser/+`; write `webrtc/answer/+`, `webrtc/ice/pi/+`, `webrtc/error/+` |

### 3. Give `webrtc-bridge` credentials [U]
`webrtc_bridge.py` has no username or password support (no `username_pw_set`, no `MQTT_USER` or `MQTT_PASS` read). It also supports a plain TCP URL: `parse_broker` treats `mqtt://host:port` as TCP and `ws://`, `wss://` as WebSocket. Before step 5:
1. Add the account from step 2: `sudo mosquitto_passwd /etc/mosquitto/passwd pi_webrtc` (prompts for a password).
2. Patch the script on the Pi so the client calls `username_pw_set(os.environ["MQTT_USER"], os.environ["MQTT_PASS"])` before `connect`.
3. In the unit, replace `MQTT_BROKER=ws://<DROPLET_PUBLIC_IP>:9001` with `MQTT_BROKER=mqtt://<DROPLET_TAILNET_IP>:1883` and add `MQTT_USER` and `MQTT_PASS` (use an `EnvironmentFile` with mode 600, not the unit text). The script's own default is `wss://hyxc.io/mqtt`; that needs a Cloudflare tunnel route to the broker's WebSocket listener and still needs the same credentials, so the tailnet TCP address is simpler.
4. `sudo systemctl daemon-reload && sudo systemctl restart webrtc-bridge`.

Expected: `ss -tn | grep 1883` on the Pi shows its connection to the tailnet address, none to the public address. Browser camera signalling still works.

### 4. Retire the public WebSocket page [U]
`~/stm32_bridge/web_dashboard/index.html` hard-codes `ws://<DROPLET_PUBLIC_IP>:9001` with no credentials and publishes `pump/cmd`, `relay/cmd`, `mode/cmd`. Nothing was found listening that serves it, so it is dead today. Either delete it or leave it knowing it stops working at step 6. Browser-side credentials would be visible to every viewer, so do not "fix" it by adding some.

### 5. Rotate the web app's broker password [U]
The `nextjs` password was written in plain text in the 2026-11-03 handoff document. Set a new one and put it in the same two places:
```bash
sudo mosquitto_passwd /etc/mosquitto/passwd nextjs
```
Then update `MQTT_PASSWORD` in the droplet's `app.env` (mode 600). Do not run `docker run --env-file` against `app.env`: the quoted `PGOPTIONS` value keeps its quotes that way and breaks the database connection. Recreate the container with `docker compose` as `deploy/pull-deploy.sh` does.

### 6. Apply the secure broker config [U]
```bash
sudo cp /etc/mosquitto/secure.conf.staged /etc/mosquitto/conf.d/secure.conf
sudo mv /etc/mosquitto/conf.d/default.conf /etc/mosquitto/default.conf.disabled
sudo systemctl restart mosquitto
```
The staged file has no listener on 9001 or 8883, so both close. Expected: `systemctl is-active mosquitto` prints `active`.

### 7. Verify from outside [R]
From a machine that is not on the tailnet, a credential-less CONNECT to `<DROPLET_PUBLIC_IP>:1883` must be refused or time out. Then confirm all of: the dashboard shows live data and a command is acknowledged (`control_audit` row, device state changes); the six Pi services are connected (`ss -tn` on the Pi); the camera page connects. If anything fails, restore the backup from step 1.

### 8. Disable the dead legacy service [U]
`water_gateway.service` points at `ExecStart=…/water-web/ai-receiver/tapo_env/bin/python3`, which no longer exists, and has restarted 757 times.
```bash
sudo systemctl disable --now water_gateway
```

### 9. Decide who writes `stm32/cmd/raw` [U, your call]
Two Pi services publish it: `cmd_node` (the web path, no mode rule) and `dashboard_tx_node` (the Pi's local dashboard path, allows pump commands only in MANUAL with both masters on). Each copies the relay state from the last status message, so near-simultaneous commands can overwrite each other. Not yet reproduced. If the local dashboard is not used, stop `dashboard_tx_node`; if it is, leave both and treat the collision as a known risk.

### 10. Current check at the pump [U, at the site]
The meter reads 0 A, 0 W and 0 kWh in every one of 7,202 retained frames, including 2,971 where a pump relay bit is set. With a clamp meter on the pump line and the pump relay on in MANUAL mode:
- Clamp reads current, PZEM reads 0 → the meter's current sensor is not on that circuit, or the controller does not read the current registers.
- Clamp reads 0 too → the pump does not run (relay open, breaker off): the relay bit is not proof of a running pump.

## Rollback summary
Steps 3-6: copy `/root/mosquitto-backup/<date>` back to `/etc/mosquitto`, restore the previous unit file, `sudo systemctl restart mosquitto webrtc-bridge`.
