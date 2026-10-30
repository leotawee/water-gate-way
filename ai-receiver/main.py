#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Water Gate Way - AI Receiver Hub (main.py)  —  Industrial Grade

FastAPI + MQTT + Serial hub with strict command validation.

Dependencies:
    pip install fastapi uvicorn pydantic pyserial paho-mqtt

Deployment:
    python main.py
"""

import asyncio
import hmac
import json
import os
import re
import threading
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional, Set

import paho.mqtt.client as mqtt
import serial
from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel


# ===========================================================================
# CONFIGURATION
# ===========================================================================

DEFAULT_SERIAL_PORTS = ["/dev/ttyS0", "/dev/ttyAMA0"]
SERIAL_PORTS = [os.getenv("WGW_SERIAL_PORT", "/dev/ttyS0")]
for _p in DEFAULT_SERIAL_PORTS:
    if _p not in SERIAL_PORTS:
        SERIAL_PORTS.append(_p)

SERIAL_BAUD = 9600
SERIAL_TIMEOUT = 1
RECONNECT_DELAY = 3.0

# WHY: no hardcoded broker host. Missing config fails at import, before any connect.
MQTT_HOST = os.getenv("MQTT_HOST")
if not MQTT_HOST:
    raise SystemExit("[FATAL] Missing required env var MQTT_HOST. See .env.example.")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))
TOPIC_CONTROL = os.getenv("MQTT_TOPIC_CONTROL", "water/gate/control")
TOPIC_STATUS = os.getenv("MQTT_TOPIC_STATUS", "water/gate/status")

# WHY: loopback by default; only the Next.js server on this host calls FastAPI.
API_HOST = os.getenv("API_HOST", "127.0.0.1")
API_PORT = 8000
WS_PING_INTERVAL = 30.0

# ── STRICT COMMAND WHITELIST ──
VALID_COMMANDS = {
    "P1", "P0",  # Pump normal
    "A1", "A0",  # Alarm
    "L1", "L0",  # Light
    "M1", "M0",  # AI mode
    "R1", "R0",  # Relay 1
    "Q1", "Q0",  # Relay 2
}
CMD_PATTERN = re.compile(r"^[A-Z][01]$")

MIN_SECRET_LEN = 32


def require_control_secret() -> str:
    """Return CONTROL_SHARED_SECRET or exit. Called at startup, not at import,
    so tests can import this module without a secret."""
    secret = os.getenv("CONTROL_SHARED_SECRET", "")
    if len(secret) < MIN_SECRET_LEN:
        raise SystemExit(
            f"[FATAL] CONTROL_SHARED_SECRET missing or shorter than {MIN_SECRET_LEN} chars. See .env.example."
        )
    return secret


def verify_control_token(x_control_token: Optional[str] = Header(default=None)) -> None:
    # WHY: constant-time compare on bytes (str compare_digest rejects non-ASCII);
    # same generic 401 for missing and wrong so nothing leaks.
    expected = os.getenv("CONTROL_SHARED_SECRET", "").encode("utf-8")
    given = (x_control_token or "").encode("utf-8")
    if len(expected) < MIN_SECRET_LEN or not hmac.compare_digest(given, expected):
        raise HTTPException(status_code=401, detail="unauthorized")


# ===========================================================================
# SHARED STATE
# ===========================================================================

class AppState:
    def __init__(self) -> None:
        self.latest_person_count: int = 0
        self.latest_stm32_data: dict = {}
        self.serial_port: Optional[serial.Serial] = None
        self.serial_lock = threading.Lock()
        self.ws_clients: Set[WebSocket] = set()
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self.mqtt_connected: bool = False


state = AppState()
mqtt_client: Optional[mqtt.Client] = None


# ===========================================================================
# PYDANTIC MODELS
# ===========================================================================

class PersonCountPayload(BaseModel):
    count: int


class CommandPayload(BaseModel):
    command: str


# ===========================================================================
# VALIDATION & FILTERING
# ===========================================================================

def sanitize_command(raw: str) -> Optional[str]:
    """
    Industrial-grade command sanitizer.

    Returns the cleaned 2-character command if valid,
    or None if the input is garbage.
    """
    if not raw:
        return None
    # Strip whitespace, null bytes, newlines, carriage returns
    cleaned = raw.strip().upper()
    cleaned = cleaned.replace("\x00", "")
    cleaned = cleaned.replace("\n", "")
    cleaned = cleaned.replace("\r", "")

    if len(cleaned) != 2:
        print(f"[VALIDATOR] REJECTED (len={len(cleaned)}): {cleaned!r}")
        return None
    if cleaned not in VALID_COMMANDS:
        print(f"[VALIDATOR] REJECTED (unknown): {cleaned!r}")
        return None
    return cleaned


# ===========================================================================
# MQTT HANDLERS
# ===========================================================================

def on_mqtt_connect(client: mqtt.Client, _userdata, _flags, rc: int) -> None:
    if rc == 0:
        state.mqtt_connected = True
        print(f"[MQTT] Connected to {MQTT_HOST}:{MQTT_PORT}")
        client.subscribe(TOPIC_CONTROL)
        print(f"[MQTT] Subscribed -> {TOPIC_CONTROL}")
    else:
        state.mqtt_connected = False
        print(f"[MQTT] Connection failed, code={rc}")


def on_mqtt_disconnect(_client: mqtt.Client, _userdata, rc: int) -> None:
    state.mqtt_connected = False
    print(f"[MQTT] Disconnected (code={rc}), retrying...")


def on_mqtt_message(_client: mqtt.Client, _userdata, msg: mqtt.MQTTMessage) -> None:
    topic = msg.topic
    raw_payload = msg.payload.decode("utf-8", errors="ignore")
    print(f"[MQTT RX RAW] {topic}: {raw_payload!r}")

    if topic == TOPIC_CONTROL:
        cmd = sanitize_command(raw_payload)
        if cmd:
            send_cmd(cmd)


def start_mqtt() -> None:
    global mqtt_client
    print(f"[MQTT] Starting -> {MQTT_HOST}:{MQTT_PORT}")
    mqtt_client = mqtt.Client()
    mqtt_client.on_connect = on_mqtt_connect
    mqtt_client.on_disconnect = on_mqtt_disconnect
    mqtt_client.on_message = on_mqtt_message
    mqtt_client.reconnect_delay_set(min_delay=1, max_delay=10)

    try:
        mqtt_client.connect(MQTT_HOST, MQTT_PORT, 60)
        mqtt_client.loop_start()
    except Exception as exc:
        print(f"[MQTT] Initial connect failed: {exc}")
        print("[MQTT] Will keep retrying in background...")
        mqtt_client.loop_start()


def mqtt_publish_status(data_dict: dict) -> None:
    if mqtt_client is not None and state.mqtt_connected:
        try:
            mqtt_client.publish(TOPIC_STATUS, json.dumps(data_dict), qos=0)
        except Exception as exc:
            print(f"[MQTT PUB ERROR] {exc}")


# ===========================================================================
# SERIAL COMMAND SENDER
# ===========================================================================

def send_cmd(cmd: str) -> bool:
    """
    Transmit a validated command to the STM32 over serial.
    The command MUST already be sanitized before reaching here.
    Returns True only if the bytes were written to an open port.
    """
    payload = cmd.strip()
    if len(payload) != 2:
        print(f"[SERIAL TX REJECTED] Bad length: {payload!r}")
        return False

    with state.serial_lock:
        if state.serial_port is not None and state.serial_port.is_open:
            try:
                state.serial_port.reset_output_buffer()
                state.serial_port.write(payload.encode("utf-8"))
                state.serial_port.flush()
                print(f"[SERIAL TX SUCCESS] Sent: {payload!r}")
                return True
            except Exception as exc:
                print(f"[SERIAL TX ERROR] {exc}")
                return False
        print(f"[SERIAL TX MOCK] {payload!r} (port closed)")
        return False


# ===========================================================================
# STM32 SERIAL PARSER
# ===========================================================================

def parse_stm32_line(raw: str) -> Optional[dict]:
    if not raw.startswith("S,"):
        return None
    parts = raw.split(",")
    if len(parts) < 16:
        return None
    try:
        return {
            "PZEM": {
                "voltage": float(parts[1]),
                "current": float(parts[2]),
                "power": float(parts[3]),
                "energy": float(parts[4]),
                "frequency": float(parts[5]),
                "pf": float(parts[6]),
            },
            "Radar": {
                "distance": float(parts[7]),
                "detected": bool(int(parts[8])),
            },
            "Floats": {
                "upper": bool(int(parts[9])),
                "lower": bool(int(parts[10])),
            },
            "WireBreak": bool(int(parts[11])),
            "Pumps": {
                "pump1": bool(int(parts[12])),
                "pump2": bool(int(parts[13])),
            },
            "Alarm": bool(int(parts[14])),
            "AI_detect": bool(int(parts[15])),
        }
    except (ValueError, IndexError):
        return None


# ===========================================================================
# BACKGROUND SERIAL READER
# ===========================================================================

def _try_open_serial() -> Optional[serial.Serial]:
    for port in SERIAL_PORTS:
        try:
            ser = serial.Serial(
                port=port,
                baudrate=SERIAL_BAUD,
                timeout=SERIAL_TIMEOUT,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE,
            )
            print(f"[SERIAL] Connected to {port} @ {SERIAL_BAUD} baud")
            return ser
        except serial.SerialException:
            print(f"[SERIAL] Port {port} unavailable.")
    return None


def serial_reader_thread() -> None:
    while True:
        with state.serial_lock:
            state.serial_port = _try_open_serial()

        if state.serial_port is None:
            print(f"[SERIAL] All ports failed. Retrying in {RECONNECT_DELAY}s...")
            time.sleep(RECONNECT_DELAY)
            continue

        try:
            while state.serial_port is not None and state.serial_port.is_open:
                try:
                    raw_bytes = state.serial_port.readline()
                except serial.SerialException:
                    break

                if not raw_bytes:
                    continue

                try:
                    line = raw_bytes.decode("utf-8").strip()
                except UnicodeDecodeError:
                    line = raw_bytes.decode("latin-1").strip()

                if not line:
                    continue

                print(f"[SERIAL RX] {line}")

                parsed = parse_stm32_line(line)
                if parsed:
                    state.latest_stm32_data = parsed
                    unified = build_unified_payload()
                    _broadcast_now(unified)
                    mqtt_publish_status(unified)
        except Exception as exc:
            print(f"[SERIAL] Unexpected error: {exc}")

        with state.serial_lock:
            if state.serial_port is not None:
                try:
                    state.serial_port.close()
                except Exception:
                    pass
                state.serial_port = None

        print(f"[SERIAL] Reconnecting in {RECONNECT_DELAY}s...")
        time.sleep(RECONNECT_DELAY)


# ===========================================================================
# WEBSOCKET BROADCAST
# ===========================================================================

def build_unified_payload() -> dict:
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "person_count": state.latest_person_count,
        "stm32": state.latest_stm32_data,
    }


def _broadcast_now(payload: dict) -> None:
    if state.loop is None or not state.ws_clients:
        return
    coro = _broadcast_to_all(payload)
    asyncio.run_coroutine_threadsafe(coro, state.loop)


async def _broadcast_to_all(payload: dict) -> None:
    disconnected: Set[WebSocket] = set()
    payload_text = json.dumps(payload)
    for client in state.ws_clients:
        try:
            await client.send_text(payload_text)
        except Exception:
            disconnected.add(client)
    if disconnected:
        state.ws_clients -= disconnected


# ===========================================================================
# FASTAPI LIFESPAN
# ===========================================================================

@asynccontextmanager
async def lifespan(_app: FastAPI):
    require_control_secret()
    state.loop = asyncio.get_running_loop()
    start_mqtt()
    thread = threading.Thread(target=serial_reader_thread, daemon=True)
    thread.start()
    print("[LIFESPAN] Serial + MQTT started.")
    yield
    print("[LIFESPAN] Shutting down...")
    if mqtt_client is not None:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()
    with state.serial_lock:
        if state.serial_port is not None and state.serial_port.is_open:
            state.serial_port.close()


# ===========================================================================
# FASTAPI APP
# ===========================================================================

app = FastAPI(
    title="Water Gate Way - AI Receiver",
    version="3.0.0",
    lifespan=lifespan,
)

# WHY: no CORS middleware. Browsers never call FastAPI; only the Next.js server does.


# ===========================================================================
# HTTP ENDPOINTS
# ===========================================================================

@app.get("/api/serial-status")
async def serial_status():
    with state.serial_lock:
        port = state.serial_port
        if port is not None and port.is_open:
            return {"status": "open", "port": port.port, "baudrate": port.baudrate}
    return {"status": "closed", "port": None, "baudrate": None}


@app.get("/api/mqtt-status")
async def mqtt_status():
    return {
        "connected": state.mqtt_connected,
        "broker": f"{MQTT_HOST}:{MQTT_PORT}",
        "control_topic": TOPIC_CONTROL,
        "status_topic": TOPIC_STATUS,
    }


@app.post("/api/control", dependencies=[Depends(verify_control_token)])
async def control_command(payload: CommandPayload):
    """HTTP fallback — also validates before sending."""
    cmd = sanitize_command(payload.command)
    if not cmd:
        return {"status": "rejected", "reason": "invalid command"}
    # WHY: no MQTT echo to TOPIC_CONTROL. This process subscribes to that topic,
    # so an echo re-enters on_mqtt_message and sends the command to serial twice.
    if not send_cmd(cmd):
        # WHY: 503 instead of 200 so the caller never treats an unsent command as done
        return JSONResponse(
            status_code=503,
            content={"status": "unavailable", "reason": "serial port not open", "command": cmd},
        )
    return {"status": "ok", "command_sent": cmd}


@app.post("/api/update-count", dependencies=[Depends(verify_control_token)])
async def update_count(payload: PersonCountPayload):
    state.latest_person_count = payload.count
    serial_sent = send_cmd("M1" if payload.count > 0 else "M0")
    unified = build_unified_payload()
    await _broadcast_to_all(unified)
    mqtt_publish_status(unified)
    return {"status": "ok", "person_count": payload.count, "serial_sent": serial_sent}


# ===========================================================================
# WEBSOCKET ENDPOINT
# ===========================================================================

@app.websocket("/ws/detections")
async def websocket_detections(websocket: WebSocket):
    await websocket.accept()
    state.ws_clients.add(websocket)
    print(f"[WS] Client connected. Total: {len(state.ws_clients)}")
    try:
        await websocket.send_json(build_unified_payload())
    except Exception:
        pass
    try:
        while True:
            try:
                await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=WS_PING_INTERVAL,
                )
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        print("[WS] Client disconnected cleanly.")
    except Exception as exc:
        print(f"[WS] Error: {exc}")
    finally:
        state.ws_clients.discard(websocket)
        print(f"[WS] Client removed. Total: {len(state.ws_clients)}")


# ===========================================================================
# ENTRY POINT
# ===========================================================================

if __name__ == "__main__":
    import uvicorn
    require_control_secret()
    uvicorn.run("main:app", host=API_HOST, port=API_PORT, reload=False, log_level="info")
