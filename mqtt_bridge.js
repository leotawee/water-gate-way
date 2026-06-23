#!/usr/bin/env node
/**
 * Water Gate Way - MQTT-to-PostgreSQL Bridge
 * ============================================
 *
 * Permanent background service that:
 *   1. Connects to the external Enterprise MQTT broker
 *   2. Subscribes to watergate/telemetry
 *   3. Parses incoming JSON sensor payloads
 *   4. Inserts them securely into the local Docker PostgreSQL DB
 *
 * Run directly:
 *   node mqtt_bridge.js
 *
 * Run with PM2 (recommended for production):
 *   pm2 start mqtt_bridge.js --name wg-bridge
 *   pm2 save
 *   pm2 startup
 *
 * Run as systemd service:
 *   See mqtt-bridge.service template in this repo.
 */

const mqtt = require('mqtt');
const { Pool } = require('pg');

/* ───────────────────── Configuration ───────────────────── */

const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://178.128.49.254:1883';
const MQTT_TOPIC  = process.env.MQTT_TOPIC  || 'watergate/telemetry';
const MQTT_QOS    = Number(process.env.MQTT_QOS) || 1;

const PG_CONFIG = {
  user:     process.env.PGUSER     || 'water_admin',
  host:     process.env.PGHOST     || '172.17.0.2',
  database: process.env.PGDATABASE || 'watergate_db',
  password: process.env.PGPASSWORD || 'zxc123',
  port:     Number(process.env.PGPORT) || 5432,
};

/* ───────────────────── PostgreSQL Pool ───────────────────── */

const pool = new Pool(PG_CONFIG);

pool.on('error', (err) => {
  console.error('[PG] Unexpected pool error:', err.message);
});

/* ───────────────────── DB Helpers ───────────────────── */

async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS water_levels (
      id           SERIAL PRIMARY KEY,
      device_id    VARCHAR(50),
      water_height REAL,
      measured_at  TIMESTAMP
    );
  `;
  await pool.query(sql);
}

async function insertTelemetry(payload) {
  const device_id    = typeof payload.device_id    === 'string' ? payload.device_id    : 'unknown';
  const water_height = typeof payload.water_height === 'number' ? payload.water_height : 0;

  // If the hardware sends a timestamp, use it; otherwise use DB NOW().
  const measured_at = payload.measured_at
    ? new Date(payload.measured_at)
    : new Date();

  const sql = `
    INSERT INTO water_levels (device_id, water_height, measured_at)
    VALUES ($1, $2, $3)
    RETURNING id;
  `;

  const { rows } = await pool.query(sql, [device_id, water_height, measured_at]);
  return rows[0].id;
}

/* ───────────────────── MQTT Client ───────────────────── */

const client = mqtt.connect(MQTT_BROKER, {
  reconnectPeriod: 5000,   // Auto-reconnect every 5s
  connectTimeout: 30000,   // 30s connection timeout
  clean: true,
});

let messageCount = 0;
let errorCount   = 0;

client.on('connect', () => {
  console.log(`[MQTT] Connected → ${MQTT_BROKER}`);
  client.subscribe(MQTT_TOPIC, { qos: MQTT_QOS }, (err) => {
    if (err) {
      console.error(`[MQTT] Subscribe failed:`, err.message);
    } else {
      console.log(`[MQTT] Subscribed → topic="${MQTT_TOPIC}" qos=${MQTT_QOS}`);
    }
  });
});

client.on('message', async (topic, message) => {
  const raw = message.toString();
  console.log(`[MQTT] RX → ${raw}`);

  try {
    const payload = JSON.parse(raw);

    // Validate minimum required fields
    if (!payload.device_id || typeof payload.water_height !== 'number') {
      console.warn('[Bridge] Invalid payload (missing device_id or water_height). Skipping.');
      return;
    }

    const insertedId = await insertTelemetry(payload);
    messageCount += 1;

    console.log(
      `[DB] Inserted row id=${insertedId} | ` +
      `device=${payload.device_id} | ` +
      `height=${payload.water_height}m | ` +
      `total_msgs=${messageCount}`
    );
  } catch (err) {
    errorCount += 1;
    console.error(`[Bridge] Processing error:`, err.message);
  }
});

client.on('error', (err) => {
  console.error('[MQTT] Client error:', err.message);
});

client.on('close', () => {
  console.warn('[MQTT] Connection closed. Will auto-reconnect...');
});

client.on('offline', () => {
  console.warn('[MQTT] Client offline.');
});

/* ───────────────────── Graceful Shutdown ───────────────────── */

async function shutdown(signal) {
  console.log(`\n[Bridge] Received ${signal}. Shutting down gracefully...`);

  try {
    client.end(true);      // Force-close MQTT connection
    await pool.end();      // Drain PG pool
    console.log(`[Bridge] Stats: ${messageCount} msgs processed, ${errorCount} errors.`);
    console.log('[Bridge] Goodbye!');
  } catch (err) {
    console.error('[Bridge] Shutdown error:', err.message);
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
  shutdown('unhandledRejection');
});

/* ───────────────────── Startup ───────────────────── */

(async () => {
  try {
    console.log('=' .repeat(55));
    console.log('🌊 Water Gate Way - MQTT-to-PostgreSQL Bridge');
    console.log('=' .repeat(55));
    console.log(`[Config] MQTT : ${MQTT_BROKER}`);
    console.log(`[Config] Topic: ${MQTT_TOPIC}`);
    console.log(`[Config] PG   : ${PG_CONFIG.host}:${PG_CONFIG.port}/${PG_CONFIG.database}`);
    console.log('=' .repeat(55));

    await ensureTable();
    console.log('[DB] Table "water_levels" ensured.\n');
  } catch (err) {
    console.error('[FATAL] Startup failed:', err.message);
    process.exit(1);
  }
})();
