# Pi person detector: go live and bring the code into git

## [16:20] Findings and changes on the Pi

- **Action:** read `~/wgw-detect` on the Pi (YOLO11n ONNX, preview only, service not installed, `.env` without MQTT user/password); changed `mqtt_client.connect` to `connect_async`; added `pi_gate` credentials to `.env` (copied on the Pi from the existing service, never printed); ran 80 s previews; owner installed the service; switched stream to `office3`; lowered `WGW_CONF` 0.7 to 0.5.
- **Why:** a failed `connect()` at boot would kill the camera thread silently; the broker now requires credentials; conf 0.7 reset the 3 s debounce because a close-up, tilted person scored 0.5-0.9 while empty scenes score <= 0.03.
- **Result:** 1.2-1.5 fps, load average about 0.85 on 4 cores, `water/gate/person` published with `source: pi_yolo`; `stable=True` reached with a person in view of office3. Camera 1 faces the cabinet interior, so it can only count 0.
- **Lesson:** measure the raw score distribution (person vs empty) before choosing a threshold; a hard debounce on a flickering score hides a working model.

## [16:30] Code into git

- **Action:** copied `detector.py`, `index.html`, `README.md`, `.env.example`, `wgw-detect.service` to `pi/wgw-detect/`; `.gitignore` excludes the 10 MB model, `.env`, venv and backups; example env now matches the running values.
- **Why:** the only copy was on a Pi that browns out.
- **Result:** secret scan of the copied files found no credentials.

## Summary

- Changed: Pi `detector.py` (connect_async), `.env` (creds, stream, conf); repo gets `pi/wgw-detect/`.
- Unchanged: STM32 services, broker, web app (already reads `water/gate/person`).
- Remaining: rotate `pi_gate` password (6 characters; needs sudo on droplet and Pi); fix camera mounting; real gate-side test; model file backup; debounce tolerates no missed frame.
- Mistakes & dead ends: first tests used office1 (cabinet interior) and conf 0.7, so counted 0 although the model worked; the first service start crash-looped 16 times because my preview still held port 8080.
- 📌 GENERAL: when a detector reports zero, look at what the camera sees before tuning the model.
