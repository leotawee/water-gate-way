/**
 * ============================================================
 *  UI_APP.H — Application State, Color Palette & Shared Types
 *  ESP32-S3 HMI Water Gate Controller
 * ============================================================
 */
#pragma once

#include <lvgl.h>
#include "hw_config.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ═══════════════════════════════════════════════════════════
 *  COLOR PALETTE  —  Dark Cyberpunk Theme
 *  (Extracted from HTML mockup CSS)
 * ═══════════════════════════════════════════════════════════ */
#define CLR_BG_SCREEN       lv_color_hex(0x0F0F23)   /* #0F0F23 — main screen bg           */
#define CLR_BG_PANEL        lv_color_hex(0x1A1A2E)   /* #1A1A2E — card / column bg         */
#define CLR_BG_INNER        lv_color_hex(0x1A1A3E)   /* #1A1A3E — inner panel / box bg     */
#define CLR_BG_BAR_TRACK    lv_color_hex(0x0A0A1A)   /* #0A0A1A — bar track background     */
#define CLR_BORDER          lv_color_hex(0x2A2A4A)   /* #2A2A4A — border lines             */
#define CLR_ACCENT          lv_color_hex(0x00BCD4)   /* #00BCD4 — cyan accent (primary)    */
#define CLR_ORANGE          lv_color_hex(0xFF9800)   /* #FF9800 — mode badge / threshold   */
#define CLR_GREEN           lv_color_hex(0x4CAF50)   /* #4CAF50 — pump running             */
#define CLR_GREEN_BG        lv_color_hex(0x1B5E20)   /* #1B5E20 — pump run background      */
#define CLR_RED             lv_color_hex(0xF44336)   /* #F44336 — danger / Lv3             */
#define CLR_GRAY            lv_color_hex(0x9E9E9E)   /* #9E9E9E — pump stopped text        */
#define CLR_GRAY_BG         lv_color_hex(0x424242)   /* #424242 — pump stop background     */
#define CLR_BAR_START       lv_color_hex(0x0066CC)   /* #0066CC — bar gradient bottom      */
#define CLR_TEXT_DIM        lv_color_hex(0x666666)   /* #666666 — dim unit text            */
#define CLR_TEXT_LABEL      lv_color_hex(0x888888)   /* #888888 — secondary labels         */
#define CLR_TEXT_WHITE      lv_color_hex(0xFFFFFF)   /* #FFFFFF — threshold labels         */

/* ═══════════════════════════════════════════════════════════
 *  PUMP STATE ENUM
 * ═══════════════════════════════════════════════════════════ */
typedef enum {
    PUMP_STOP = 0,
    PUMP_RUN  = 1
} pump_state_t;

/* ═══════════════════════════════════════════════════════════
 *  OPERATION MODE ENUM
 * ═══════════════════════════════════════════════════════════ */
typedef enum {
    MODE_AUTO   = 0,
    MODE_MANUAL = 1
} op_mode_t;

/* ═══════════════════════════════════════════════════════════
 *  APPLICATION STATE  —  sensor data & config
 *  Updated by UART ISR / parser, consumed by UI refresh
 * ═══════════════════════════════════════════════════════════ */
typedef struct {
    /* Live sensor readings (from STM32 via UART) */
    float water_level;           /* Current water level  (m) */
    float distance;              /* Raw distance reading (m) */
    float sensor_height;         /* Install height       (m) */

    /* Pump states */
    pump_state_t pump1;          /* PUMP 1 state */
    pump_state_t pump2;          /* PUMP 2 state */

    /* Operation mode */
    op_mode_t mode;              /* AUTO / MANUAL */

    /* Threshold configuration (editable on settings screen) */
    float threshold_lv1;         /* Lv1 — Stop all pumps   (m) */
    float threshold_lv2;         /* Lv2 — Start pump 1     (m) */
    float threshold_lv3;         /* Lv3 — Start pump 1 + 2 (m) */

    /* Dirty flag — set true when UART data updates values */
    volatile bool data_updated;
} app_state_t;

/* ── Global state instance (defined in ui_app.cpp) ── */
extern app_state_t app_state;

/* ═══════════════════════════════════════════════════════════
 *  SCREEN HANDLES
 * ═══════════════════════════════════════════════════════════ */
extern lv_obj_t *ui_main_screen;
extern lv_obj_t *ui_settings_screen;

/* ═══════════════════════════════════════════════════════════
 *  INIT & REFRESH API
 * ═══════════════════════════════════════════════════════════ */

/**
 * Initialize shared styles & default app_state values.
 * Call once before creating any screens.
 */
void ui_app_init(void);

/**
 * Push current app_state values into the main-screen widgets.
 * Safe to call from the main loop whenever data_updated == true.
 */
void ui_main_screen_refresh(void);

/**
 * Send current sensor config to STM32 via UART.
 */
void uart_send_sensor_config(float water_level, float distance, float height);

/**
 * Send threshold config to STM32 via UART.
 */
void uart_send_threshold_config(float lv1, float lv2, float lv3);

#ifdef __cplusplus
}
#endif
