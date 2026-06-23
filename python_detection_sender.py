#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Water Gate Way - Real-time Person Detection & Serial Transmitter.

Deploys on Raspberry Pi Model B using an Ultralytics YOLO11 ONNX model.
Captures an RTSP stream, runs 320x320 person-only inference via ONNX
Runtime (ARM CPU optimised), and pushes lightweight count frames over
serial in the format::

    P:COUNT\n
Example payloads::

    P:0\n
    P:3\n
"""

import sys
import time
from typing import Optional

# ---------------------------------------------------------------------------
# Pylint suppression for OpenCV
# ---------------------------------------------------------------------------
# cv2 is a set of auto-generated C-extension bindings.  Pylint cannot
# introspect the binary module, so every cv2.* access triggers a false
# positive E1101 (no-member).  We disable the check for the whole file
# because every cv2 call would otherwise need its own pragma.
# ---------------------------------------------------------------------------
# pylint: disable=no-member
import cv2
import numpy as np
import serial

from ultralytics import YOLO


# ===========================================================================
# DEPLOYMENT CONFIGURATION -- EDIT THESE VALUES FOR YOUR ENVIRONMENT
# ===========================================================================

# Full RTSP URL for the Tapo / IP camera.
RTSP_URL = "rtsp://admin:password@192.168.1.100:554/stream1"

# Serial device path on the Raspberry Pi (common USB-UART adapter).
SERIAL_PORT = "/dev/ttyUSB0"

# Baud rate optimised for fast Pi-to-microcontroller communication.
BAUD_RATE = 115200

# YOLO11 Nano model exported to ONNX for embedded inference.
MODEL_PATH = "yolo11n.onnx"

# Minimum confidence to accept a detection (YOLO11 Nano works well at 0.25).
CONFIDENCE_THRESHOLD = 0.25

# Square input size for low-latency inference on ARM CPU.
INFERENCE_SIZE = 320

# COCO dataset class ID for "person".  Passing this directly to the model
# filters predictions in NMS, saving CPU cycles and guaranteeing only
# people are counted.
COCO_CLASS_PERSON = 0

# Small throttle between frames (~30 ms) to keep CPU load sustainable.
FRAME_DELAY = 0.03


# ===========================================================================
# HELPER FUNCTIONS
# ===========================================================================


def setup_camera(rtsp_url: str) -> Optional[cv2.VideoCapture]:
    """
    Open an RTSP or local V4L2 stream and minimise internal buffering.

    Setting CAP_PROP_BUFFERSIZE to 1 reduces latency so the pipeline
    always works on the newest frame rather than a stale queue.

    Args:
        rtsp_url: Full device or RTSP URL (e.g. rtsp://... or /dev/video0).

    Returns:
        Configured cv2.VideoCapture instance, or None on failure.
    """
    print(f"[CAM] Opening stream: {rtsp_url}")
    cap = cv2.VideoCapture(rtsp_url)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

    if not cap.isOpened():
        print("[CAM] ERROR: Failed to open video stream.")
        print("       Check the URL, credentials, and network path.")
        return None

    print("[CAM] Stream opened successfully.")
    return cap


def setup_serial(port: str, baud_rate: int) -> Optional[serial.Serial]:
    """
    Initialise the UART / USB-serial port at 115200 baud.

    Args:
        port: Serial device path (e.g. /dev/ttyUSB0 or /dev/ttyACM0).
        baud_rate: Communication speed in baud.

    Returns:
        Open serial.Serial instance, or None if the port is unavailable.
    """
    try:
        ser = serial.Serial(port=port, baudrate=baud_rate, timeout=1)
        print(f"[SER] Port opened: {port} @ {baud_rate} baud")
        return ser
    except serial.SerialException as exc:
        print(f"[SER] WARNING: Cannot open {port}: {exc}")
        print("       Continuing in headless mode (serial output disabled).")
        return None


def send_detection_data(ser: Optional[serial.Serial], count: int) -> None:
    """
    Build and transmit the person-count payload over serial.

    Protocol format (lightweight ASCII, newline-terminated)::

        P:COUNT\n
    Args:
        ser: Active serial port (None if unavailable).
        count: Pre-extracted number of humans detected in the frame.
    """
    payload = f"P:{count}\n"

    if ser is not None and ser.is_open:
        try:
            ser.write(payload.encode("utf-8"))
            ser.flush()
            print(f"[TX] Sent: {payload.strip()}")
        except serial.SerialException as exc:
            print(f"[TX] ERROR writing to serial: {exc}")
    else:
        print(f"[TX] MOCK (no serial): {payload.strip()}")


def _warmup_model(model: YOLO, imgsz: int) -> None:
    """
    Run a single dummy inference to warm up the ONNX Runtime session.

    On ARM CPUs the first forward pass incurs graph-optimisation and
    memory-allocation overhead.  A warmup prevents that cost from
    hitting the live detection pipeline.
    """
    print("[INF] Warming up ONNX session...")
    dummy = np.zeros((imgsz, imgsz, 3), dtype=np.uint8)
    model.predict(source=dummy, imgsz=imgsz, verbose=False)
    print("[INF] Warmup complete.")


def main() -> int:
    """
    Frame-by-frame inference pipeline.

    The loop captures a frame, runs YOLO11n ONNX inference filtered to
    class 0 (person), counts the resulting bounding boxes, and forwards
    that count over serial.

    Returns:
        Exit code (0 = clean shutdown, 1 = fatal initialisation error).
    """
    print("=" * 60)
    print(" Water Gate Way - Person Detection Sender")
    print(" Raspberry Pi Model B  |  YOLO11n ONNX  |  320 px")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # 1. Load ONNX model
    # -----------------------------------------------------------------------
    print(f"[MDL] Loading: {MODEL_PATH}")
    model = YOLO(MODEL_PATH)
    print("[MDL] Model loaded.  ONNX Runtime ready for ARM CPU.")

    # Warm-up avoids first-frame stutter on embedded devices.
    _warmup_model(model, INFERENCE_SIZE)

    # -----------------------------------------------------------------------
    # 2. Open peripherals
    # -----------------------------------------------------------------------
    cap = setup_camera(RTSP_URL)
    if cap is None:
        return 1

    ser = setup_serial(SERIAL_PORT, BAUD_RATE)

    print("=" * 60)
    print(" LOOP STARTED")
    print("   Press 'q' in the video window, or Ctrl+C, to quit.")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # 3. Inference loop
    # -----------------------------------------------------------------------
    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                print("[CAM] Frame dropped.  Retrying...")
                time.sleep(0.5)
                continue

            # Run inference.
            # classes=0 forces the post-processor to keep ONLY the COCO
            # "person" class.  This slashes CPU load on the Pi because
            # NMS no longer evaluates 79 other COCO categories.
            results = model.predict(
                source=frame,
                imgsz=INFERENCE_SIZE,
                verbose=False,
                conf=CONFIDENCE_THRESHOLD,
                classes=COCO_CLASS_PERSON
            )

            # Extract the person count from the result bounding boxes.
            person_count = 0
            if results and len(results) > 0:
                boxes = results[0].boxes
                if boxes is not None:
                    person_count = len(boxes)

            # Push count to downstream serial device.
            send_detection_data(ser, person_count)

            # Visual feedback on the Pi desktop (optional).
            annotated_frame = results[0].plot() if results else frame
            cv2.imshow("Water Gate Way - Person Detector", annotated_frame)

            if cv2.waitKey(1) & 0xFF == ord("q"):
                print("[CTL] Quit key pressed.")
                break

            time.sleep(FRAME_DELAY)

    except KeyboardInterrupt:
        print("\n[CTL] Interrupted by user (Ctrl+C).")

    finally:
        print("[CTL] Shutting down gracefully...")
        cap.release()
        cv2.destroyAllWindows()
        if ser is not None and ser.is_open:
            ser.close()
            print("[SER] Serial port closed.")
        print("[CTL] Shutdown complete.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
