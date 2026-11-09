# Pi deploy — person detection (preview phase)

ไดเรกทอรีบน Pi: `~/wgw-detect/` — **สร้างใหม่ทั้งหมด ไม่แตะไฟล์เดิมของ Pi และไม่เกี่ยวกับระบบ water-gate**

สถาปัตยกรรม: กล้อง Tapo (RTSP) → Pi 4 รัน YOLO11n ONNX ด้วย onnxruntime (ไม่มี torch) → หน้าเว็บพรีวิวบน loopback
ค่าที่ตกลงกัน: conf = **0.5** (เดิม 0.7 พลาดคนที่เห็นไม่เต็มตัว วัดจริงบน Pi 9 พ.ย.), input = **320px**, debounce = **3 วินาที** (พบคนต่อเนื่อง 3 วิ จึงนับเป็น "พบคน")

## ติดตั้ง (ผมทำขั้น 1–3 ให้แล้ว)

1. ไฟล์อยู่ที่ `~/wgw-detect/` (detector.py, index.html, yolo11n.onnx, .env.example, wgw-detect.service)
2. venv + deps: `~/wgw-detect/.venv` (onnxruntime, opencv-python-headless, numpy)
3. **คุณต้องทำเอง — สร้าง .env (มีรหัสกล้อง ห้ามส่งมาในแชท):**
   ```bash
   cd ~/wgw-detect && cp .env.example .env && nano .env
   ```
   แก้ `WGW_RTSP_URL` เป็น URL จริงของ Tapo (user/password/IP ของกล้อง)
4. รันพรีวิว:
   ```bash
   cd ~/wgw-detect && set -a && . ./.env && set +a && ./.venv/bin/python detector.py
   ```
5. ดูผลจาก Mac (SSH tunnel — เซิร์ฟเวอร์ bind 127.0.0.1 บน Pi เท่านั้น ไม่เปิดพอร์ตสู่เครือข่าย):
   ```bash
   ssh -L 8080:127.0.0.1:8080 pi@water
   ```
   แล้วเปิด http://127.0.0.1:8080 ในเบราว์เซอร์

## อ่านผลหน้าเว็บ

- **จำนวนคนที่ตรวจพบ (ดิบ)** — จำนวนกล่องในเฟรมล่าสุด
- **ยืนยันแล้ว (debounce)** — `ON` เมื่อพบคนต่อเนื่อง ≥ 3 วิ (ตัวนี้คือค่าที่จะใช้จริง)
- FPS — คาด ~3–15 FPS บน Pi 4 ที่ 320px (วัดจริงแล้วรายงานมา)

## ระบบ systemd (หลังพรีวิวผ่านเท่านั้น)

```bash
sudo cp ~/wgw-detect/wgw-detect.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now wgw-detect
```
Serial → STM32 (P:COUNT) และ alarm M1 **ไม่ทำ ตามการตัดสินใจของเจ้าของ** — จำนวนคนขึ้น dashboard ทาง MQTT แทน

## เชื่อม dashboard (ทาง 2)

- detector.py ยิง `{"person_count": n, "raw_count": m, "stable": bool}` ไป `water/gate/person` (QoS 1, retain)
  เมื่อค่าที่ผ่าน debounce เปลี่ยน หรือทุก 5 วิ (heartbeat)
- ฝั่ง Next.js (`src/lib/telemetry/broker.ts`) subscribe topic นี้แล้ว **merge** `personCount` เข้าสถานะล่าสุด
  (ไม่ทับสถานะปั๊ม/ระดับน้ำ) — การ์ด "การตรวจจับคน" โชว์ค่านี้
- สิ่งที่ต้องมี: broker user `pi_gate` สิทธิ์ write `water/gate/person` (ตาม ACL ทาง 2) — เจ้าของสร้างบน droplet
  แล้วกรอก `WGW_MQTT_HOST/USER/PASS` ใน .env เอง (รหัสไม่ผ่านแชท)

## หมายเหตุ

- ตัวสคริปต์ reconnect RTSP เองเมื่อ stream หลุด (รอ 3 วินาทีต่อรอบ)
- ถ้า `pip install` ติดเพราะ wheel ไม่มีสำหรับ aarch64 → ใช้ `sudo apt install python3-onnxruntime python3-opencv` แล้วรันด้วย system python แทน (แจ้งผมได้ ผมจะปรับ)

## โมเดล

`yolo11n.onnx` (~10 MB) ไม่ถูก commit (อยู่ใน .gitignore) วางไว้ที่ `~/wgw-detect/yolo11n.onnx` บน Pi
ได้จากการ export YOLO11n ของ Ultralytics เป็น ONNX ที่ input 320 (ยังไม่ได้ยืนยันคำสั่ง export ที่ใช้จริง สำรองไฟล์จาก Pi ไว้)

## สถานะบน Pi (2026-11-09)

ติดตั้งเป็น service `wgw-detect` แล้ว อ่านกล้อง office3 (ตั้งใน .env) ถ้าล้มให้ดู `journalctl -u wgw-detect`
รีสตาร์ทหลังแก้ .env: `sudo systemctl restart wgw-detect`
