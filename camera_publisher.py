#!/usr/bin/env python3
"""
Water Gate Way - Camera Publisher via MQTT
============================================

This script captures video from Tapo C310 via RTSP and publishes
Base64-encoded JPEG frames to MQTT broker for the dashboard.

Author: Hardware Team
Date: 2026-04-22
"""

import cv2
import paho.mqtt.client as mqtt
import base64
import time
import argparse

# ==================== CONFIGURATION ====================

# RTSP URL of Tapo C310 camera
RTSP_URL = "rtsp://admin:YOUR_PASSWORD@192.168.1.150/stream1"

# MQTT Broker settings
MQTT_BROKER = "178.128.49.254"
MQTT_PORT = 1883
MQTT_TOPIC = "gate/camera/stream"
MQTT_QOS = 0
MQTT_RETAIN = False

# Video settings
FPS = 15
JPEG_QUALITY = 80
FRAME_WIDTH = 640
FRAME_HEIGHT = 480

# Display settings
SHOW_WINDOW = True
WINDOW_NAME = "Publishing to MQTT..."

# ==================== MQTT CLIENT ====================

def on_connect(client, userdata, flags, rc):
    """Callback when connected to MQTT broker"""
    if rc == 0:
        print(f"✅ Connected to MQTT broker: {MQTT_BROKER}:{MQTT_PORT}")
    else:
        print(f"❌ Failed to connect, return code {rc}")

def on_publish(client, userdata, mid):
    """Callback when message is published"""
    pass  # Silent success

def on_disconnect(client, userdata, rc):
    """Callback when disconnected from MQTT broker"""
    if rc != 0:
        print(f"⚠️  Unexpected disconnection from MQTT broker (rc={rc})")

# ==================== MAIN FUNCTION ====================

def main():
    """Main function to capture and publish video frames"""

    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Publish camera frames to MQTT")
    parser.add_argument("--rtsp", default=RTSP_URL, help="RTSP URL of camera")
    parser.add_argument("--broker", default=MQTT_BROKER, help="MQTT broker address")
    parser.add_argument("--port", type=int, default=MQTT_PORT, help="MQTT broker port")
    parser.add_argument("--topic", default=MQTT_TOPIC, help="MQTT topic")
    parser.add_argument("--fps", type=int, default=FPS, help="Frames per second")
    parser.add_argument("--quality", type=int, default=JPEG_QUALITY, help="JPEG quality (1-100)")
    parser.add_argument("--width", type=int, default=FRAME_WIDTH, help="Frame width")
    parser.add_argument("--height", type=int, default=FRAME_HEIGHT, help="Frame height")
    parser.add_argument("--no-display", action="store_true", help="Don't show preview window")

    args = parser.parse_args()

    print("=" * 50)
    print("🎬 Water Gate Way - Camera Publisher")
    print("=" * 50)
    print(f"📹 RTSP Source: {args.rtsp}")
    print(f"🌐 MQTT Broker: {args.broker}:{args.port}")
    print(f"📡 MQTT Topic: {args.topic}")
    print(f"🎥 Resolution: {args.width}x{args.height} @ {args.fps}fps")
    print("=" * 50)

    # Setup MQTT client
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_publish = on_publish
    client.on_disconnect = on_disconnect

    # Connect to MQTT broker
    print(f"🔗 Connecting to MQTT broker {args.broker}:{args.port}...")
    client.connect(args.broker, args.port, 60)
    client.loop_start()

    # Open RTSP stream
    print(f"📹 Opening RTSP stream: {args.rtsp}")
    cap = cv2.VideoCapture(args.rtsp)

    # Set resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    cap.set(cv2.CAP_PROP_FPS, args.fps)

    if not cap.isOpened():
        print("❌ Failed to open RTSP stream!")
        return

    print("✅ RTSP stream opened successfully")
    print("📸 Publishing frames to MQTT... (Press 'q' to quit)")

    frame_count = 0
    start_time = time.time()
    fps_time = start_time
    fps_frames = 0

    try:
        while True:
            ret, frame = cap.read()

            if not ret:
                print("❌ Failed to read frame from RTSP stream")
                time.sleep(1)
                continue

            # Resize frame
            frame = cv2.resize(frame, (args.width, args.height))

            # Encode as JPEG
            encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), args.quality]
            _, buffer = cv2.imencode('.jpg', frame, encode_param)

            # Convert to Base64
            jpg_as_text = base64.b64encode(buffer).decode('utf-8')

            # Publish to MQTT
            client.publish(
                args.topic,
                jpg_as_text,
                qos=args.qos if hasattr(args, 'qos') else MQTT_QOS,
                retain=args.retain if hasattr(args, 'retain') else MQTT_RETAIN
            )

            frame_count += 1
            fps_frames += 1

            # Calculate FPS every second
            current_time = time.time()
            if current_time - fps_time >= 1.0:
                fps = fps_frames / (current_time - fps_time)
                print(f"📊 FPS: {fps:.1f} | Frames: {frame_count} | Size: {len(jpg_as_text)} bytes")
                fps_frames = 0
                fps_time = current_time

            # Show preview window
            if not args.no_display:
                cv2.imshow(WINDOW_NAME, frame)

                # Add FPS overlay
                elapsed = current_time - start_time
                total_fps = frame_count / elapsed if elapsed > 0 else 0
                cv2.putText(
                    frame,
                    f"FPS: {total_fps:.1f} | Frames: {frame_count}",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )
                cv2.imshow(WINDOW_NAME, frame)

            # Exit on 'q' key
            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("\n🛑 Quit requested by user")
                break

            # Control frame rate
            time.sleep(1.0 / args.fps)

    except KeyboardInterrupt:
        print("\n🛑 Interrupted by user")

    except Exception as e:
        print(f"\n❌ Error: {e}")

    finally:
        # Cleanup
        print("🧹 Cleaning up...")
        cap.release()
        client.loop_stop()
        client.disconnect()
        cv2.destroyAllWindows()

        elapsed = time.time() - start_time
        avg_fps = frame_count / elapsed if elapsed > 0 else 0
        print(f"📊 Published {frame_count} frames in {elapsed:.1f} seconds")
        print(f"📊 Average FPS: {avg_fps:.1f}")
        print("✅ Done!")

if __name__ == "__main__":
    main()
