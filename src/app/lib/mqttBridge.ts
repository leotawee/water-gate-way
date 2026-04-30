import mqtt from 'mqtt';

// --- Configuration (ใช้ Broker เดิมที่มาสเตอร์เคยใช้) ---
const MQTT_BROKER = 'mqtt://178.128.49.254';
const TOPIC_SUB = 'RCN/WaterGate/status'; // หัวข้อที่เครื่องส่งสัญญาณมา
const PHP_URL = 'http://localhost:3000'; // URL ปลายทางที่จะส่งรหัสไป

const client = mqtt.connect(MQTT_BROKER);

client.on('connect', () => {
   
    client.subscribe(TOPIC_SUB);
});

client.on('message', async (topic, message) => {
    try {
        // รับรหัส (Python formatted string หรือ JSON)
        const rawData = message.toString();
        console.log(`📩 Received Code: ${rawData}`);

        // --- ส่งต่อไปยัง Web App หรือ Database ---
        // ถ้านายต้องการยิงเข้า PHP เหมือนเดิมให้ใช้ fetch:
        const response = await fetch(PHP_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                'code': rawData,
                'status': 'received'
            })
        });

        const result = await response.text();
        console.log(`🚀 Sent to Backend: ${result}`);

    } catch (error) {
        console.error("❌ Bridge Error:", error);
    }
});