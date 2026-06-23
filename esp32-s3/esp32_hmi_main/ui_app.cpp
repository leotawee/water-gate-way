/**
 * ============================================================
 *  UI_APP.CPP — Shared state & UART stubs
 * ============================================================
 */

#include "ui_app.h"
#include "HardwareSerial.h"

/* ── Global application state (mock defaults) ── */
app_state_t app_state = {
    .water_level   = 1.25f,        /* mocked initial level */
    .distance      = 1.25f,        /* mocked initial distance */
    .sensor_height = 2.50f,        /* mocked sensor height */

    .pump1         = PUMP_RUN,     /* Pump 1 running  */
    .pump2         = PUMP_STOP,    /* Pump 2 stopped  */

    .mode          = MODE_AUTO,

    .threshold_lv1 = 0.80f,
    .threshold_lv2 = 1.50f,
    .threshold_lv3 = 1.80f,

    .data_updated  = false
};

/* ── Screen handles (populated by their respective create functions) ── */
lv_obj_t *ui_main_screen     = nullptr;
lv_obj_t *ui_settings_screen = nullptr;

/* ═══════════════════════════════════════════════════════════
 *  ui_app_init  —  set defaults
 * ═══════════════════════════════════════════════════════════ */
void ui_app_init(void)
{
    /* State is already initialised by the struct literal above.
       Extend here if you need runtime logic (NVFS read, etc.) */
}

/* ═══════════════════════════════════════════════════════════
 *  UART STUBS — implement your STM32 protocol here
 *
 *  Suggested binary packet format:
 *    [0xAA] [0x55] [LEN:u8] [CMD:u8] [PAYLOAD...] [CHK:u8]
 *
 *  CMD values:
 *    0x01 — Periodic sensor data (water_level, pumps, mode)
 *    0x10 — Sensor config ACK
 *    0x11 — Threshold config ACK
 * ═══════════════════════════════════════════════════════════ */

/**
 * Build & transmit a sensor-config packet to STM32.
 */
void uart_send_sensor_config(float water_level, float distance, float height)
{
    /* ─── PLACEHOLDER ───
     *
     * Example using a simple text protocol:
     *   Serial2.printf("CFG:W=%.2f,D=%.2f,H=%.2f\n", water_level, distance, height);
     *
     * Or pack into a binary frame:
     *   uint8_t buf[32];
     *   buf[0] = 0xAA; buf[1] = 0x55;
     *   buf[2] = 14;               // payload length
     *   buf[3] = 0x10;             // CMD: sensor config
     *   memcpy(&buf[4],  &water_level, 4);
     *   memcpy(&buf[8],  &distance,    4);
     *   memcpy(&buf[12], &height,      4);
     *   buf[16] = checksum(buf, 16);
     *   Serial2.write(buf, 17);
     */
    (void)water_level;
    (void)distance;
    (void)height;
}

/**
 * Build & transmit a threshold-config packet to STM32.
 */
void uart_send_threshold_config(float lv1, float lv2, float lv3)
{
    /* ─── PLACEHOLDER ───
     *
     * Example binary frame:
     *   uint8_t buf[20];
     *   buf[0] = 0xAA; buf[1] = 0x55;
     *   buf[2] = 14;
     *   buf[3] = 0x11;             // CMD: threshold config
     *   memcpy(&buf[4],  &lv1, 4);
     *   memcpy(&buf[8],  &lv2, 4);
     *   memcpy(&buf[12], &lv3, 4);
     *   buf[16] = checksum(buf, 16);
     *   Serial2.write(buf, 17);
     */
    (void)lv1;
    (void)lv2;
    (void)lv3;
}
