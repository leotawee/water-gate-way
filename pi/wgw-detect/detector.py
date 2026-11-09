#!/usr/bin/env python3
"""Person detection for the gate camera (Raspberry Pi 4).

Same settings as the MacBook demo (person-only, conf 0.7, input 320) but:
  - runs YOLO11n ONNX via onnxruntime (NO torch / ultralytics on the Pi)
  - source is the Tapo RTSP stream from WGW_RTSP_URL
  - a person is reported only after WGW_DEBOUNCE seconds of continuous detection
    (hysteresis: must also be absent WGW_DEBOUNCE seconds before clearing)

Preview mode (default) serves the same test page as the MacBook demo on
WGW_BIND:WGW_PORT. Serial/STM32 reporting is intentionally NOT implemented yet.

Run:  ~/wgw-detect/.venv/bin/python detector.py
"""
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Condition, Thread

import cv2
import numpy as np
import onnxruntime as ort

MODEL_PATH = os.getenv("WGW_MODEL", str(Path(__file__).parent / "yolo11n.onnx"))
RTSP_URL = os.getenv("WGW_RTSP_URL", "")
CONF = float(os.getenv("WGW_CONF", "0.7"))
SIZE = int(os.getenv("WGW_SIZE", "320"))
DEBOUNCE = float(os.getenv("WGW_DEBOUNCE", "3.0"))
BIND = os.getenv("WGW_BIND", "127.0.0.1")
PORT = int(os.getenv("WGW_PORT", "8080"))
# MQTT publish (path 2): the dashboard count comes from here, not from serial/STM32.
# Leave WGW_MQTT_HOST empty to run preview-only without a broker connection.
MQTT_HOST = os.getenv("WGW_MQTT_HOST", "")
MQTT_PORT = int(os.getenv("WGW_MQTT_PORT", "1883"))
MQTT_USER = os.getenv("WGW_MQTT_USER", "")
MQTT_PASS = os.getenv("WGW_MQTT_PASS", "")
MQTT_TOPIC = os.getenv("WGW_MQTT_TOPIC", "water/gate/person")
HEARTBEAT = float(os.getenv("WGW_HEARTBEAT", "5.0"))
# The Pi also runs the STM32 bridge and go2rtc on a supply that sags under load: keep inference light.
THREADS = int(os.getenv("WGW_THREADS", "1"))
MAX_FPS = float(os.getenv("WGW_MAX_FPS", "1.5"))
PERSON_CLASS = 0
NMS_IOU = 0.45
RETRY_DELAY = 3.0

INDEX_HTML = (Path(__file__).parent / "index.html").read_text(encoding="utf-8")


class DetectionState:
    def __init__(self) -> None:
        self.cond = Condition()
        self.jpeg = b""
        self.count = 0            # raw boxes this frame
        self.stable = False       # debounced person-present latch
        self.fps = 0.0
        self.error = ""
        self.frames = 0

    def publish(self, jpeg, count, stable, fps) -> None:
        with self.cond:
            self.jpeg = jpeg
            self.count = count
            self.stable = stable
            self.fps = fps
            self.frames += 1
            self.cond.notify_all()

    def fail(self, message: str) -> None:
        with self.cond:
            self.error = message
            self.cond.notify_all()


state = DetectionState()


def letterbox(frame: np.ndarray) -> np.ndarray:
    """Resize keeping aspect ratio, pad to SIZE x SIZE (ultralytics-style, top-left)."""
    h, w = frame.shape[:2]
    scale = min(SIZE / w, SIZE / h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    resized = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)
    canvas = np.full((SIZE, SIZE, 3), 114, dtype=np.uint8)
    canvas[:nh, :nw] = resized
    return canvas, scale


def detect(session, input_name, frame: np.ndarray):
    """Returns (boxes_on_frame, person_count)."""
    blob, scale = letterbox(frame)
    x = blob[:, :, ::-1].transpose(2, 0, 1).astype(np.float32) / 255.0
    out = session.run(None, {input_name: x[None]})[0]  # (1, 84, 8400)
    pred = out[0]
    scores = pred[4 + PERSON_CLASS, :]
    keep = np.where(scores >= CONF)[0]
    if keep.size == 0:
        return frame, 0
    # cx,cy,w,h at input scale -> x1,y1,x2,y2
    b = pred[:4, keep].T
    xyxy = np.stack(
        [b[:, 0] - b[:, 2] / 2, b[:, 1] - b[:, 3] / 2,
         b[:, 0] + b[:, 2] / 2, b[:, 1] + b[:, 3] / 2], axis=1)
    idxs = cv2.dnn.NMSBoxes(
        xyxy.tolist(), scores[keep].tolist(), CONF, NMS_IOU)
    count = 0
    h, w = frame.shape[:2]
    for i in np.array(idxs).reshape(-1):
        x1, y1, x2, y2 = xyxy[i] / scale  # back to original frame scale
        x1, y1 = max(0, int(x1)), max(0, int(y1))
        x2, y2 = min(w - 1, int(x2)), min(h - 1, int(y2))
        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 144, 30), 2)
        cv2.putText(frame, f"person {scores[keep][i]:.2f}", (x1, max(15, y1 - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 144, 30), 1, cv2.LINE_AA)
        count += 1
    cv2.putText(frame, f"persons: {count}", (10, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (0, 0, 255), 2, cv2.LINE_AA)
    return frame, count


def camera_loop() -> None:
    if not RTSP_URL:
        state.fail("WGW_RTSP_URL is not set (copy .env.example to .env and fill it in)")
        return
    # OpenCV 5 dropped the 3-argument VideoCapture(url, api, params); TCP is selected through the ffmpeg env option.
    os.environ.setdefault("OPENCV_FFMPEG_CAPTURE_OPTIONS", "rtsp_transport;tcp")
    so = ort.SessionOptions()
    so.intra_op_num_threads = THREADS
    so.inter_op_num_threads = 1
    session = ort.InferenceSession(MODEL_PATH, sess_options=so, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    print("model loaded:", MODEL_PATH, flush=True)

    # debounced latch: on after DEBOUNCE s of presence, off after DEBOUNCE s of absence
    stable = False
    presence_since = None
    absence_since = None

    mqtt_client = None
    if MQTT_HOST:
        import paho.mqtt.client as mqtt
        try:
            mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
        except AttributeError:  # paho 1.x
            mqtt_client = mqtt.Client()
        if MQTT_USER:
            mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
        mqtt_client.reconnect_delay_set(1, 30)
        mqtt_client.connect_async(MQTT_HOST, MQTT_PORT, keepalive=30)  # never raise at boot: a dead thread would stop counting silently
        mqtt_client.loop_start()
        print("mqtt:", MQTT_HOST, MQTT_PORT, MQTT_TOPIC, flush=True)

    last_effective = None
    last_sent = 0.0

    def publish_count() -> None:
        # The dashboard value is the debounced one; raw_count rides along for debugging.
        nonlocal last_effective, last_sent
        if mqtt_client is None:
            return
        payload = json.dumps({
            "person_count": count if stable else 0,
            "raw_count": count,
            "stable": stable,
            "source": "pi_yolo",
        })
        mqtt_client.publish(MQTT_TOPIC, payload, qos=1, retain=True)
        last_effective = count if stable else 0
        last_sent = time.time()

    while True:
        cap = cv2.VideoCapture(RTSP_URL, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            state.fail(f"cannot open RTSP stream; retry in {RETRY_DELAY:.0f}s")
            time.sleep(RETRY_DELAY)
            continue
        last = time.time()
        fps = 0.0
        next_at = 0.0
        try:
            while True:
                # grab() keeps the decoder current (no stale backlog); only retrieve+infer at MAX_FPS.
                if not cap.grab():
                    break  # stream hiccup -> reconnect
                if time.time() < next_at:
                    continue
                ok, frame = cap.retrieve()
                if not ok:
                    break
                next_at = time.time() + 1.0 / MAX_FPS
                frame, count = detect(session, input_name, frame)
                now = time.time()
                if count > 0:
                    if presence_since is None:
                        presence_since = now
                    absence_since = None
                    if not stable and now - presence_since >= DEBOUNCE:
                        stable = True
                else:
                    if absence_since is None:
                        absence_since = now
                    presence_since = None
                    if stable and now - absence_since >= DEBOUNCE:
                        stable = False
                inst = 1.0 / max(now - last, 1e-6)
                last = now
                fps = 0.9 * fps + 0.1 * inst if fps else inst
                okjpg, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                if okjpg:
                    state.publish(buf.tobytes(), count, stable, fps)
                now2 = time.time()
                effective = count if stable else 0
                if effective != last_effective or now2 - last_sent >= HEARTBEAT:
                    publish_count()
        finally:
            cap.release()
        state.fail("RTSP stream ended; reconnecting…")
        time.sleep(RETRY_DELAY)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code, ctype, body):
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/":
            self._send(200, "text/html; charset=utf-8", INDEX_HTML.encode())
        elif self.path == "/stats":
            with state.cond:
                payload = json.dumps({
                    "person_count": state.count,
                    "stable": state.stable,
                    "fps": round(state.fps, 1),
                    "conf": CONF,
                    "size": SIZE,
                    "debounce": DEBOUNCE,
                    "frames": state.frames,
                    "running": state.frames > 0,
                    "error": state.error,
                })
            self._send(200, "application/json", payload.encode())
        elif self.path == "/stream.mjpg":
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.end_headers()
            try:
                while True:
                    with state.cond:
                        if not state.jpeg:
                            state.cond.wait(timeout=2)
                            continue
                        frame = state.jpeg
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\n\r\n")
                    self.wfile.write(frame)
                    self.wfile.write(b"\r\n")
                    time.sleep(0.1)  # Pi inference is slower; pace the stream
            except (BrokenPipeError, ConnectionResetError):
                pass
        else:
            self._send(404, "text/plain", b"not found")


if __name__ == "__main__":
    Thread(target=camera_loop, daemon=True).start()
    server = ThreadingHTTPServer((BIND, PORT), Handler)
    print(f"detector preview on http://{BIND}:{PORT}", flush=True)
    server.serve_forever()
