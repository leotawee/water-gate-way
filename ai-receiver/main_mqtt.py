import network
import socket
from machine import Pin
import time

# ========================================================
# 🕷️ 1. ตั้งค่าระบบควบคุมมอเตอร์ Tarantulia (พ่วง L298N)
# ========================================================
motor_in1 = Pin(12, Pin.OUT)
motor_in2 = Pin(13, Pin.OUT)

def robot_forward():
    motor_in1.value(1)
    motor_in2.value(0)
    print("-> [WALK FORWARD]")

def robot_backward():
    motor_in1.value(0)
    motor_in2.value(1)
    print("<- [WALK BACKWARD]")

def robot_stop():
    motor_in1.value(0)
    motor_in2.value(0)
    print("|| [STOP]")

# เริ่มต้นระบบให้หุ่นยนต์หยุดนิ่งเพื่อความปลอดภัย
robot_stop()

# ========================================================
# 🌐 2. ระบบเชื่อมต่อ Wi-Fi (เวอร์ชันแก้ไขบั๊ก Internal Error)
# ========================================================
WIFI_SSID = "CMMC_AIS_2.4G"  # เคลียร์เป็นคลื่น 2.4G เรียบร้อยเกาะติดง่ายแน่นอน   
WIFI_PASS = "zxc12345"    

wlan = network.WLAN(network.STA_IF)
wlan.active(True)

# สั่งเคลียร์สถานะชิป Wi-Fi รอบเก่า และหน่วงเวลาหายใจ 1 วินาที
wlan.disconnect()
time.sleep(1) 

wlan.connect(WIFI_SSID, WIFI_PASS)

print("Connecting to Wi-Fi...", end="")
# ระบบ Timeout ป้องกันบอร์ดค้างคอยตลอดกาล
timeout = 0
while not wlan.isconnected() and timeout < 20:
    print(".", end="")
    time.sleep(0.5)
    timeout += 1

# แสดงผลการเชื่อมต่อเครือข่าย
if wlan.isconnected():
    print("\n[เครือข่ายไร้สายเชื่อมต่อสำเร็จ!]")
    print("📍 Mini32 IP Address:", wlan.ifconfig()[0]) # เอาเลขนี้ไปกรอกในคอมพิวเตอร์นะ Prite!
else:
    print("\n❌ Wi-Fi Connection Failed! Please Check SSID/PASS or Press Reset Button.")

# ========================================================
# 📡 3. เปิดช่องทางรับคำสั่งไร้สายผ่าน UDP Socket (Port 5005)
# ========================================================
UDP_IP = "0.0.0.0" 
UDP_PORT = 5005

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((UDP_IP, UDP_PORT))

print("UDP Server listening on port", UDP_PORT)
print("[0 Gundam System Setup Complete - Ready for Joystick Command]")

# ========================================================
# 🎮 4. Loop หลัก: รอรับคำสั่งและสับขามอเตอร์แบบ Real-time
# ========================================================
while True:
    try:
        # รอรับแพ็กเก็ตคำสั่งที่ยิงมาจากคอมพิวเตอร์
        data, addr = sock.recvfrom(1024)
        command = data.decode('utf-8').strip() # แปลงสัญญาณดิบเป็นข้อความ string
        
        # ตรรกะวิเคราะห์คำสั่งควบคุมแมงมุม
        if command == "FORWARD":
            robot_forward()
        elif command == "BACKWARD":
            robot_backward()
        elif command == "STOP":
            robot_stop()
            
    except Exception as e:
        print("Error:", e)
        robot_stop()
        time.sleep(1)