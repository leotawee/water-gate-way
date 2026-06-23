#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serial TX Tester – Interactive console for blasting control commands
directly to the STM32 controller via Raspberry Pi hardware UART.

Usage:
    # Interactive mode (type what you want to send)
    python test_tx.py

    # Auto-toggle mode (legacy loop: P1 / P0 every 2 sec)
    python test_tx.py --auto
"""

import argparse
import sys
import time

import serial

# ---------------------------------------------------------------------------
# CONFIGURATION
# ---------------------------------------------------------------------------
SERIAL_PORT = "/dev/ttyS0"      # Pi hardware UART (fallback: /dev/ttyAMA0)
SERIAL_BAUD = 9600
SERIAL_TIMEOUT = 1

# Legacy auto-loop settings
CMD_A = "P1"
CMD_B = "P0"
TOGGLE_DELAY = 2.0


def open_port() -> serial.Serial:
    """Open the serial port with explicit error messaging."""
    try:
        ser = serial.Serial(
            port=SERIAL_PORT,
            baudrate=SERIAL_BAUD,
            timeout=SERIAL_TIMEOUT,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
        )
        print(f"[OK] Opened {SERIAL_PORT} @ {SERIAL_BAUD} baud")
        return ser
    except serial.SerialException as exc:
        print(f"[FATAL] Cannot open {SERIAL_PORT}: {exc}")
        raise SystemExit(1)


def blast(ser: serial.Serial, payload: bytes, label: str = "TX") -> None:
    """Send raw bytes after clearing the output buffer, with diagnostics."""
    try:
        ser.reset_output_buffer()
        ser.write(payload)
        ser.flush()
        print(f"[{label} OK] Sent {len(payload)} byte(s): {payload!r}")
    except PermissionError as exc:
        print(f"[{label} FAIL] Permission denied writing to {SERIAL_PORT}: {exc}")
    except serial.SerialException as exc:
        print(f"[{label} FAIL] Serial error: {exc}")
    except Exception as exc:  # pylint: disable=broad-exception-caught
        print(f"[{label} FAIL] Unexpected error: {exc}")


def interactive_mode(ser: serial.Serial) -> None:
    """Read user input from stdin and transmit immediately."""
    print("\n=== INTERACTIVE SERIAL TX ===")
    print("Type any command and press ENTER to send.")
    print("Special commands:")
    print("  :raw   – disable auto-append \\n (raw mode)")
    print("  :nl    – re-enable auto-append \\n (default)")
    print("  :exit  – quit\n")

    append_newline = True

    while True:
        try:
            user_input = input("> ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\n[STOP] Interrupted.")
            break

        if not user_input:
            continue

        # Meta commands
        if user_input == ":exit":
            print("[BYE]")
            break
        if user_input == ":raw":
            append_newline = False
            print("[CONFIG] Auto-append \\n = OFF (raw mode)")
            continue
        if user_input == ":nl":
            append_newline = True
            print("[CONFIG] Auto-append \\n = ON")
            continue

        # Build payload
        if append_newline and not user_input.endswith("\n"):
            payload = (user_input + "\n").encode("utf-8")
        else:
            payload = user_input.encode("utf-8")

        blast(ser, payload, label="INTERACTIVE")


def auto_mode(ser: serial.Serial) -> None:
    """Legacy loop that toggles between CMD_A and CMD_B."""
    print("\n=== AUTO TX LOOP ===")
    print(f"Toggling between '{CMD_A}' and '{CMD_B}' every {TOGGLE_DELAY}s.")
    print("Press Ctrl+C to stop.\n")

    try:
        while True:
            # Raw
            blast(ser, CMD_A.encode("utf-8"), label="RAW")
            time.sleep(TOGGLE_DELAY)

            # With newline
            blast(ser, (CMD_A + "\n").encode("utf-8"), label="WITH\\n")
            time.sleep(TOGGLE_DELAY)

            blast(ser, CMD_B.encode("utf-8"), label="RAW")
            time.sleep(TOGGLE_DELAY)

            blast(ser, (CMD_B + "\n").encode("utf-8"), label="WITH\\n")
            time.sleep(TOGGLE_DELAY)

    except KeyboardInterrupt:
        print("\n[STOP] Interrupted by user.")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Standalone Serial TX tester for Pi hardware UART"
    )
    parser.add_argument(
        "--auto",
        action="store_true",
        help="Run legacy auto-toggle loop instead of interactive mode",
    )
    args = parser.parse_args()

    ser = open_port()

    try:
        if args.auto:
            auto_mode(ser)
        else:
            interactive_mode(ser)
    finally:
        if ser.is_open:
            ser.close()
            print(f"[OK] Closed {SERIAL_PORT}")


if __name__ == "__main__":
    main()

