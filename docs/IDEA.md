# CMMC WaterGate — Irrigation Gate dashboard

## คืออะไร
Dashboard ประตูน้ำชลประทาน (Gate 1, เชียงใหม่). ดูค่าหน้างาน real-time + สั่งอุปกรณ์จากเว็บ.
- วัด: PZEM (voltage/current/frequency), radar ระดับน้ำ (liquid/air gap), float switch F1–F3, wire break (red/blue)
- กล้อง 3 ตัว (Tapo, office1–3) ผ่าน go2rtc
- AI detection นับคน (โหมด M1/M0)
- สั่ง: pump P1/P0, alarm A1/A0, light L1/L0, AI mode M1/M0, relay1 R1/R0, relay2 Q1/Q0 (สตริง 2 ตัว raw, allowlist ตายตัว)

## Architecture
- Browser → nginx (TLS) → Next.js บน droplet (map.hyxc.io). Browser คุยกับ Next อย่างเดียว.
- Next → Postgres (docker): auth + audit ใน schema `wgw`; `water_levels` อยู่ `public`
- Next → Mosquitto (MQTT): subscribe `stm32/status/all`, `water/gate/status` → SSE `/api/status/stream`; publish คำสั่งไป `stm32/cmd`
- Next → go2rtc (บน Pi): `GET /api/camera/stream` proxy วิดีโอ fMP4 over HTTP (ไม่ใช้ WebRTC)
- Raspberry Pi หน้างาน: `stm32_bridge` (serial ↔ MQTT, 6 systemd services), go2rtc, webrtc-bridge
- STM32 = controller ปั๊ม/sensor. ESP32-S3 = จอ HMI หน้างาน (`esp32-s3/`)
- `ai-receiver/` (FastAPI, Python) + `mqtt_bridge.js` (เขียน DB) รันบนเครื่องอื่น

## Stack
Next.js 16.2.2 (App Router, `src/proxy.ts`), React 19.2.4, TypeScript, Tailwind 4, Recharts, Leaflet, mqtt 5, pg 8.20, vitest. ใช้ npm (ไม่ใช่ bun). Node 20 บน droplet, Node 26 บนเครื่อง dev.

## Rebuild (branch `feat/secure-rebuild`)
เหตุผล: เว็บเก่าโค้ด spaghetti + ช่องโหว่หลายจุด (รายละเอียดใน `docs/`).
ทำแล้ว:
- Auth: scrypt, DB session cookie `wg_session` (12 h), roles viewer < operator < admin, ไม่มี sign-up (สร้าง user ด้วย `scripts/create-user.ts`)
- ทุก API/หน้าเช็ก `requireUser()`; rate limit login + control; audit ลง `control_audit`
- Telemetry ผ่าน SSE ฝั่ง server; ข้อมูลเก่ากว่า 30 s = OFFLINE (ห้ามโชว์ค่าเก่าเป็น live)
- คำสั่งปั๊ม: QoS 0, ไม่ queue ตอน offline (คำสั่งมาช้าแย่กว่าคำสั่งล้ม)
- กล้อง: HTTP stream ผ่าน proxy ที่ต้องล็อกอิน, จำกัด 6 สตรีม/ผู้ใช้, ตัดสตรีมทุก 10 นาที
- Security headers + CSP ใน `next.config.ts`; tests 185 ผ่าน

## สถานะ (2026-10-31)
- เว็บ live = build เก่า. Build ใหม่วางบน droplet แล้ว (release dir), smoke test ผ่าน, ยังไม่สลับ
- Migration แล้ว: schema `wgw` (ไม่แตะ `public.users` เก่า)
- ยังไม่มี admin ใหม่ → ห้ามสลับ service จนสร้าง admin สำเร็จ
- รอ: cutover (systemd + nginx, ต้อง sudo), ล็อก broker, ทาง droplet → Pi สำหรับกล้อง (tailnet ACL + `tailscale serve`), ต่อใบรับรอง TLS
- Pi หน้างาน offline ตอนเช็กล่าสุด (สาเหตุยังไม่รู้)
- `water_levels` ว่าง → ไม่มีข้อมูลย้อนหลังจริง

## เอกสาร (อ่านก่อนทำงาน)
- `docs/superpowers/plans/2026-10-30-secure-rebuild.md` — แผน rebuild + findings
- `docs/superpowers/plans/2026-10-30-broker-lockdown.md` — ล็อก MQTT/พอร์ต แบบไม่ตัด Pi
- `docs/superpowers/plans/2026-10-30-deploy-droplet.md` — runbook deploy + rollback
- `docs/agent-log/` — log การทำงาน, decisions, dead ends

## กฎสำหรับ agent
- ระบบคุมปั๊มจริง: safety > ความเร็ว. คำสั่งจริงครั้งแรกต้องให้ปั๊มอยู่สถานะปลอดภัย
- Next.js 16 มี breaking changes: อ่าน `node_modules/next/dist/docs/` ก่อนเขียนโค้ด
- ห้ามปิดพอร์ต MQTT ก่อนย้าย Pi ไปใช้ Tailscale + credentials (Pi หลุด → สั่งปั๊มไม่ได้)
- ห้ามใส่ secret, รหัสผ่าน, IP ภายใน ลง repo หรือไฟล์นี้
- sudo, DB migration, ติดตั้ง dependency, ลบไฟล์, push → ต้องให้เจ้าของอนุมัติก่อน
- Command allowlist ต้องตรงกับ `VALID_COMMANDS` ใน `ai-receiver/main.py`
