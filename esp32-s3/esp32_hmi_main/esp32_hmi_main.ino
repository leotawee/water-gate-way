/**
 * ============================================================
 *  ESP32-S3 HMI WATER GATE CONTROLLER — Main Sketch
 * ============================================================
 *  Target : ESP32-S3  |  Display : 480×320 TFT (landscape)
 *  GUI    : LVGL v8.3 |  Driver  : TFT_eSPI
 *  Comms  : UART Serial2 ↔ STM32 microcontroller
 *
 *  DIRECTORY STRUCTURE (place all files in the same folder):
 *    esp32_hmi_main.ino        ← this file
 *    hw_config.h               ← pin definitions & constants
 *    ui_app.h / ui_app.cpp     ← shared state & UART stubs
 *    ui_main_screen.h/.cpp     ← main dashboard screen
 *    ui_settings_screen.h/.cpp ← settings + sub-pages
 *
 *  BEFORE COMPILING — check these three things:
 *    1. TFT_eSPI User_Setup.h — match your display driver & pins
 *    2. lv_conf.h — enable Montserrat fonts 12/14/16/20/22/28
 *       and set LV_USE_FLEX 1, LV_COLOR_DEPTH 16
 *    3. hw_config.h — adjust UART / touch pins to your board
 * ============================================================
 */

#include "lvgl.h"
#include "TFT_eSPI.h"          /* https://github.com/Bodmer/TFT_eSPI */

#include "hw_config.h"
#include "ui_app.h"
#include "ui_main_screen.h"
#include "ui_settings_screen.h"

/* ═══════════════════════════════════════════════════════════
 *  DISPLAY DRIVER
 * ═══════════════════════════════════════════════════════════ */
static TFT_eSPI tft = TFT_eSPI();          /* single instance */

/* Draw buffer — allocated in DRAM, 20 rows × 480px */
static lv_disp_draw_buf_t draw_buf;
static lv_color_t buf1[DISP_HOR_RES * LVGL_BUF_ROWS];

static lv_disp_drv_t disp_drv;
static lv_indev_drv_t indev_drv;

/* ── Display flush callback ── */
static void disp_flush_cb(lv_disp_drv_t *disp,
                           const lv_area_t *area,
                           lv_color_t *color_p)
{
    uint32_t w = (area->x2 - area->x1 + 1);
    uint32_t h = (area->y2 - area->y1 + 1);

    tft.startWrite();
    tft.setAddrWindow(area->x1, area->y1, w, h);
    tft.pushColors((uint16_t *)&color_p->full, w * h, true);
    tft.endWrite();

    lv_disp_flush_ready(disp);
}

/* ── Touch read callback (XPT2046 via TFT_eSPI built-in) ── */
static void touch_read_cb(lv_indev_drv_t *indev,
                           lv_indev_data_t *data)
{
    uint16_t x = 0, y = 0;
    bool touched = tft.getTouch(&x, &y, 600);   /* threshold 600 */

    if (touched) {
        data->point.x = x;
        data->point.y = y;
        data->state   = LV_INDEV_STATE_PR;
    } else {
        data->state = LV_INDEV_STATE_REL;
    }
}

/* ═══════════════════════════════════════════════════════════
 *  LVGL TICK — driven from millis() in loop()
 * ═══════════════════════════════════════════════════════════ */
static uint32_t last_tick_ms = 0;

/* ═══════════════════════════════════════════════════════════
 *  UART ↔ STM32
 * ═══════════════════════════════════════════════════════════ */
#define STM32_SERIAL   Serial2

/**
 * Initialize Hardware UART for STM32 communication.
 * Protocol: 115200 baud, 8N1
 *
 * PLACEHOLDER — implement your packet parser here.
 *
 * Suggested binary frame:
 *   [0xAA] [0x55] [LEN:u8] [CMD:u8] [PAYLOAD...] [CHECKSUM:u8]
 *
 * CMD 0x01 — Periodic sensor data:
 *   PAYLOAD = [water_level:f32][distance:f32]
 *             [pump1:u8][pump2:u8][mode:u8]
 */
static void uart_init(void)
{
    STM32_SERIAL.begin(STM32_BAUD, SERIAL_8N1,
                       STM32_RX_PIN, STM32_TX_PIN);
    Serial.println("[UART] Serial2 @ 115200 baud initialized");
}

/**
 * Process incoming UART bytes from STM32.
 * Called every main-loop iteration.
 *
 * ═══════════════════════════════════════════════════════════
 *  PLACEHOLDER — fill in your protocol parser.
 *
 *  When a complete packet is decoded:
 *    1. Update app_state fields
 *    2. Set app_state.data_updated = true
 *    3. The main loop will call ui_main_screen_refresh()
 * ═══════════════════════════════════════════════════════════
 */
static void uart_process(void)
{
    /* ── Simple state-machine parser skeleton ── */
    enum RxState { WAIT_HEADER1, WAIT_HEADER2, READ_LEN, READ_CMD, READ_PAYLOAD, READ_CHECKSUM };
    static RxState rx_state = WAIT_HEADER1;
    static uint8_t rx_buf[32];
    static uint8_t rx_idx  = 0;
    static uint8_t rx_len  = 0;
    static uint8_t rx_cmd  = 0;

    while (STM32_SERIAL.available()) {
        uint8_t b = STM32_SERIAL.read();

        switch (rx_state) {
        case WAIT_HEADER1:
            if (b == 0xAA) rx_state = WAIT_HEADER2;
            break;

        case WAIT_HEADER2:
            rx_state = (b == 0x55) ? READ_LEN : WAIT_HEADER1;
            break;

        case READ_LEN:
            rx_len = b;
            rx_idx = 0;
            if (rx_len > sizeof(rx_buf)) rx_state = WAIT_HEADER1;
            else rx_state = READ_CMD;
            break;

        case READ_CMD:
            rx_cmd = b;
            rx_state = READ_PAYLOAD;
            break;

        case READ_PAYLOAD:
            rx_buf[rx_idx++] = b;
            if (rx_idx >= rx_len) rx_state = READ_CHECKSUM;
            break;

        case READ_CHECKSUM: {
            /* ── Verify checksum (simple XOR of all preceding bytes) ── */
            uint8_t chk = 0xAA ^ 0x55 ^ rx_len ^ rx_cmd;
            for (uint8_t i = 0; i < rx_len; i++) chk ^= rx_buf[i];

            if (chk == b) {
                /* ─── Packet valid — parse payload ─── */
                if (rx_cmd == 0x01 && rx_len >= 13) {
                    /* CMD 0x01: periodic sensor data */
                    memcpy(&app_state.water_level, &rx_buf[0], 4);
                    memcpy(&app_state.distance,    &rx_buf[4], 4);
                    app_state.pump1 = (pump_state_t)rx_buf[8];
                    app_state.pump2 = (pump_state_t)rx_buf[9];
                    app_state.mode  = (op_mode_t)rx_buf[10];
                    app_state.sensor_height = app_state.water_level
                                            + app_state.distance;
                    app_state.data_updated = true;
                }
                /* Add more CMD handlers here (ACK, etc.) */
            }
            rx_state = WAIT_HEADER1;
            break;
        }

        default:
            rx_state = WAIT_HEADER1;
            break;
        }
    }
}

/* ═══════════════════════════════════════════════════════════
 *  SETUP
 * ═══════════════════════════════════════════════════════════ */
void setup()
{
    /* Debug console */
    Serial.begin(115200);
    Serial.println("\n[HMI] ESP32-S3 Water Gate Controller v1.0");
    Serial.println("[HMI] Initializing...");

    /* ── TFT backlight ── */
    pinMode(TFT_BL, OUTPUT);
    digitalWrite(TFT_BL, HIGH);

    /* ── TFT display ── */
    tft.begin();
    tft.setRotation(1);              /* Landscape */
    tft.fillScreen(TFT_BLACK);
    Serial.println("[HMI] TFT initialized (480x320 landscape)");

    /* ── LVGL core ── */
    lv_init();

    /* Draw buffer */
    lv_disp_draw_buf_init(&draw_buf, buf1, NULL,
                          DISP_HOR_RES * LVGL_BUF_ROWS);

    /* Display driver */
    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res  = DISP_HOR_RES;
    disp_drv.ver_res  = DISP_VER_RES;
    disp_drv.flush_cb = disp_flush_cb;
    disp_drv.draw_buf = &draw_buf;
    lv_disp_drv_register(&disp_drv);

    /* Touch input driver */
    lv_indev_drv_init(&indev_drv);
    indev_drv.type     = LV_INDEV_TYPE_POINTER;
    indev_drv.read_cb  = touch_read_cb;
    lv_indev_drv_register(&indev_drv);
    Serial.println("[HMI] LVGL display + touch registered");

    /* ── UART to STM32 ── */
    uart_init();

    /* ── Create all UI screens ── */
    ui_app_init();                    /* shared state defaults      */
    ui_main_screen_create();          /* main dashboard             */
    ui_settings_screen_create();      /* settings + sub-pages       */

    /* Load the main screen */
    lv_scr_load(ui_main_screen);
    Serial.println("[HMI] UI screens created, main screen loaded");

    /* ── Touch calibration (optional — uncomment if needed) ── */
    // uint16_t calData[5] = { 280, 3550, 360, 3400, 3 };
    // tft.setTouch(calData);

    last_tick_ms = millis();
    Serial.println("[HMI] Setup complete! Entering main loop...\n");
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN LOOP
 * ═══════════════════════════════════════════════════════════ */
void loop()
{
    /* ── 1. LVGL tick ── */
    uint32_t now = millis();
    lv_tick_inc(now - last_tick_ms);
    last_tick_ms = now;

    /* ── 2. LVGL task handler (render + animations + input) ── */
    lv_timer_handler();

    /* ── 3. UART: process data from STM32 ── */
    uart_process();

    /* ── 4. Refresh UI if new data arrived ── */
    if (app_state.data_updated) {
        ui_main_screen_refresh();
    }

    /* ── 5. Small yield to prevent WDT ── */
    delay(2);
}
