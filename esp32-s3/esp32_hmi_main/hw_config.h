/**
 * ============================================================
 *  HW_CONFIG.H — Hardware Pin Definitions & Constants
 *  ESP32-S3 HMI Water Gate Controller
 *  Display: 480x320 Landscape TFT (ILI9488/ST7796)
 *  Touch: XPT2046 SPI Resistive (or FT6236 I2C Capacitive)
 *  UART: Serial2 ↔ STM32
 * ============================================================
 *
 *  ⚠️  TFT_eSPI Library Setup Required:
 *      Copy or edit User_Setup.h in the TFT_eSPI library folder:
 *        #define ILI9488_DRIVER       (or ST7796_DRIVER)
 *        #define TFT_WIDTH  480
 *        #define TFT_HEIGHT 320
 *        #define TFT_MOSI  7
 *        #define TFT_SCLK  6
 *        #define TFT_CS    5
 *        #define TFT_DC    4
 *        #define TFT_RST   8
 *        #define TFT_BL    10
 *        #define TOUCH_CS  3
 *
 *  ⚠️  LVGL lv_conf.h — Enable these fonts:
 *        #define LV_FONT_MONTSERRAT_12  1
 *        #define LV_FONT_MONTSERRAT_14  1
 *        #define LV_FONT_MONTSERRAT_16  1
 *        #define LV_FONT_MONTSERRAT_20  1
 *        #define LV_FONT_MONTSERRAT_22  1
 *        #define LV_FONT_MONTSERRAT_28  1
 *        #define LV_USE_FLEX   1
 *        #define LV_COLOR_DEPTH 16
 * ============================================================
 */
#pragma once

#ifdef __cplusplus
extern "C" {
#endif

/* ═══════════════════════════════════════════════════════════
 *  DISPLAY
 * ═══════════════════════════════════════════════════════════ */
#define DISP_HOR_RES           480
#define DISP_VER_RES           320

/* ── SPI TFT Pin Map (ESP32-S3 GPIO) ── */
#define TFT_MOSI               7
#define TFT_CLK                6
#define TFT_CS                 5
#define TFT_DC                 4
#define TFT_RST                8
#define TFT_BL                 10

/* ── Touch Pin Map (XPT2046, shares SPI with TFT or separate) ── */
#define TOUCH_CS               3
#define TOUCH_IRQ              2
/* If touch uses separate SPI pins (uncomment & set): */
// #define TOUCH_MOSI          11
// #define TOUCH_CLK           12
// #define TOUCH_MISO          13

/* ═══════════════════════════════════════════════════════════
 *  UART ↔ STM32
 * ═══════════════════════════════════════════════════════════ */
#define STM32_UART_NUM         2       /* Hardware UART number */
#define STM32_BAUD             115200
#define STM32_TX_PIN           17      /* ESP32-S3 GPIO17 → STM32 RX */
#define STM32_RX_PIN           18      /* ESP32-S3 GPIO18 ← STM32 TX */

/* ═══════════════════════════════════════════════════════════
 *  LVGL RUNTIME
 * ═══════════════════════════════════════════════════════════ */
#define LVGL_BUF_ROWS          20      /* Draw-buffer row count */
#define LVGL_TICK_PERIOD_MS    5       /* lv_tick_inc() period  */

/* ═══════════════════════════════════════════════════════════
 *  SENSOR / SYSTEM CONSTANTS
 * ═══════════════════════════════════════════════════════════ */
#define MAX_WATER_LEVEL        2.50f   /* Sensor max range (meters)  */
#define WATER_LEVEL_PCT(wl)    ((uint8_t)(((wl) / MAX_WATER_LEVEL) * 100.0f))

#ifdef __cplusplus
}
#endif
