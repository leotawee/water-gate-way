#!/usr/bin/env node
/**
 * Water Gate Way - MQTT-to-PostgreSQL Bridge
 * ============================================
 *
 * Permanent background service that:
 *   1. Connects to the external Enterprise MQTT broker
 *   2. Subscribes to watergate/telemetry and stm32/status/all (STM32 radar status)
 *   3. Parses incoming JSON sensor payloads (status: throttled, radar.liquid only)
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

// WHY: secrets and hosts come only from env. Fail fast at startup rather than
// falling back to a hardcoded host or password.
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`[FATAL] Missing required env var ${name}. See .env.example.`);
    process.exit(1);
  }
  return value;
}

const MQTT_BROKER = requireEnv('MQTT_BROKER');
const MQTT_TOPIC  = process.env.MQTT_TOPIC  || 'watergate/telemetry';
const MQTT_QOS    = Number(process.env.MQTT_QOS) || 1;

const STATUS_TOPIC = process.env.STATUS_TOPIC || 'stm32/status/all';

// WHY: the STM32 status stream arrives every ~2s. Persisting every message would
// write ~43k rows/day, so inserts from this topic are throttled to one per window.
const STATUS_SAMPLE_SEC = (() => {
  const raw = process.env.STATUS_SAMPLE_SEC;
  if (raw === undefined || raw === '') return 60;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`[FATAL] STATUS_SAMPLE_SEC must be a positive number, got "${raw}".`);
    process.exit(1);
  }
  return value;
})();

const PG_CONFIG = {
  user:     requireEnv('PGUSER'),
  host:     requireEnv('PGHOST'),
  database: requireEnv('PGDATABASE'),
  password: requireEnv('PGPASSWORD'),
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

// Handles stm32/status/all. Inserts radar.liquid (metres) only when it is a real
// number; a null/missing reading is skipped, never stored as 0.
let lastStatusInsertAt = 0;

async function handleStatus(raw) {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.warn('[Status] Non-JSON payload. Skipping.');
    return;
  }

  const liquid = payload?.radar?.liquid;
  if (typeof liquid !== 'number' || !Number.isFinite(liquid)) {
    console.debug('[Status] radar.liquid is not a finite number. Skipping.');
    return;
  }

  const now = Date.now();
  if (now - lastStatusInsertAt < STATUS_SAMPLE_SEC * 1000) return;
  // WHY: claim the window before awaiting the insert so messages arriving
  // during the query cannot start a second insert.
  lastStatusInsertAt = now;

  const device_id = typeof payload.device_id === 'string' ? payload.device_id : 'stm32-radar';
  const parsed = typeof payload.timestamp === 'string' ? new Date(payload.timestamp) : null;
  const measured_at = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(now);

  try {
    const insertedId = await insertTelemetry({ device_id, water_height: liquid, measured_at });
    messageCount += 1;
    console.log(
      `[DB] Inserted row id=${insertedId} | ` +
      `device=${device_id} | ` +
      `height=${liquid}m | ` +
      `total_msgs=${messageCount}`
    );
  } catch (err) {
    errorCount += 1;
    console.error(`[Status] Processing error:`, err.message);
  }
}

/* ───────────────────── MQTT Client ───────────────────── */

const client = mqtt.connect(MQTT_BROKER, {
  // WHY: the broker requires a login after the lockdown; unset = anonymous (local dev only).
  // Never embed credentials in MQTT_BROKER: that URL is printed to the log.
  username: process.env.MQTT_USER || undefined,
  password: process.env.MQTT_PASS || undefined,
  reconnectPeriod: 5000,   // Auto-reconnect every 5s
  connectTimeout: 30000,   // 30s connection timeout
  clean: true,
});

let messageCount = 0;
let errorCount   = 0;

client.on('connect', () => {
  console.log(`[MQTT] Connected → ${MQTT_BROKER}`);
  client.subscribe([MQTT_TOPIC, STATUS_TOPIC], { qos: MQTT_QOS }, (err) => {
    if (err) {
      console.error(`[MQTT] Subscribe failed:`, err.message);
    } else {
      console.log(`[MQTT] Subscribed → topics="${MQTT_TOPIC}", "${STATUS_TOPIC}" qos=${MQTT_QOS}`);
    }
  });
});

client.on('message', async (topic, message) => {
  const raw = message.toString();
  if (topic === STATUS_TOPIC) {
    await handleStatus(raw);
    return;
  }
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
    console.log(`[Config] Status: ${STATUS_TOPIC} (1 insert per ${STATUS_SAMPLE_SEC}s)`);
    console.log(`[Config] PG   : ${PG_CONFIG.host}:${PG_CONFIG.port}/${PG_CONFIG.database}`);
    console.log('=' .repeat(55));

    await ensureTable();
    console.log('[DB] Table "water_levels" ensured.\n');
  } catch (err) {
    console.error('[FATAL] Startup failed:', err.message);
    process.exit(1);
  }
})();
