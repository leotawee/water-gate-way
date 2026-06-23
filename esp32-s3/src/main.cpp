/**
 * ============================================================
 *  ESP32-S3 HMI WATER GATE CONTROLLER — PlatformIO Main File
 * ============================================================
 *  Target : ESP32-S3  |  Display : 480×320 TFT (landscape)
 *  GUI    : LVGL v8.3 |  Driver  : TFT_eSPI
 *  Comms  : UART Serial2 ↔ STM32 microcontroller
 *
 *  Merged from:
 *    - esp32_hmi_main.ino (main sketch)
 *    - hw_config.h (hardware configuration)
 *    - ui_app.h/cpp (application state & UART)
 *    - ui_main_screen.h/cpp (main dashboard)
 *    - ui_settings_screen.h/cpp (settings pages)
 *
 *  BEFORE COMPILING — ensure libraries are installed:
 *    - LVGL
 *    - TFT_eSPI
 * ============================================================
 */

#include <lvgl.h>
#include <TFT_eSPI.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ═══════════════════════════════════════════════════════════
 *  HW_CONFIG.H — Hardware Pin Definitions & Constants
 * ═══════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════
 *  UART ↔ STM32
 * ═══════════════════════════════════════════════════════════ */
#define STM32_UART_NUM         2
#define STM32_BAUD             115200
#define STM32_TX_PIN           17
#define STM32_RX_PIN           18

/* ═══════════════════════════════════════════════════════════
 *  LVGL RUNTIME
 * ═══════════════════════════════════════════════════════════ */
#define LVGL_BUF_ROWS          20
#define LVGL_TICK_PERIOD_MS    5

/* ═══════════════════════════════════════════════════════════
 *  SENSOR / SYSTEM CONSTANTS
 * ═══════════════════════════════════════════════════════════ */
#define MAX_WATER_LEVEL        2.50f
#define WATER_LEVEL_PCT(wl)    ((uint8_t)(((wl) / MAX_WATER_LEVEL) * 100.0f))

#ifdef __cplusplus
}
#endif

/* ═══════════════════════════════════════════════════════════
 *  UI_APP.H — Application State, Color Palette & Shared Types
 * ═══════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════
 *  COLOR PALETTE  —  Dark Cyberpunk Theme
 * ═══════════════════════════════════════════════════════════ */
#define CLR_BG_SCREEN       lv_color_hex(0x0F0F23)
#define CLR_BG_PANEL        lv_color_hex(0x1A1A2E)
#define CLR_BG_INNER        lv_color_hex(0x1A1A3E)
#define CLR_BG_BAR_TRACK    lv_color_hex(0x0A0A1A)
#define CLR_BORDER          lv_color_hex(0x2A2A4A)
#define CLR_ACCENT          lv_color_hex(0x00BCD4)
#define CLR_ORANGE          lv_color_hex(0xFF9800)
#define CLR_GREEN           lv_color_hex(0x4CAF50)
#define CLR_GREEN_BG        lv_color_hex(0x1B5E20)
#define CLR_RED             lv_color_hex(0xF44336)
#define CLR_GRAY            lv_color_hex(0x9E9E9E)
#define CLR_GRAY_BG         lv_color_hex(0x424242)
#define CLR_BAR_START       lv_color_hex(0x0066CC)
#define CLR_TEXT_DIM        lv_color_hex(0x666666)
#define CLR_TEXT_LABEL      lv_color_hex(0x888888)
#define CLR_TEXT_WHITE      lv_color_hex(0xFFFFFF)

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
 * ═══════════════════════════════════════════════════════════ */
typedef struct {
    float water_level;
    float distance;
    float sensor_height;
    pump_state_t pump1;
    pump_state_t pump2;
    op_mode_t mode;
    float threshold_lv1;
    float threshold_lv2;
    float threshold_lv3;
    volatile bool data_updated;
} app_state_t;

/* ── Global state instance ── */
app_state_t app_state = {
    .water_level   = 1.25f,
    .distance      = 1.25f,
    .sensor_height = 2.50f,
    .pump1         = PUMP_RUN,
    .pump2         = PUMP_STOP,
    .mode          = MODE_AUTO,
    .threshold_lv1 = 0.80f,
    .threshold_lv2 = 1.50f,
    .threshold_lv3 = 1.80f,
    .data_updated  = false
};

/* ── Screen handles ── */
lv_obj_t *ui_main_screen     = nullptr;
lv_obj_t *ui_settings_screen = nullptr;

/* ═══════════════════════════════════════════════════════════
 *  FUNCTION DECLARATIONS
 * ═══════════════════════════════════════════════════════════ */
void ui_app_init(void);
void ui_main_screen_refresh(void);
void ui_main_screen_create(void);
void ui_settings_screen_create(void);
void uart_send_sensor_config(float water_level, float distance, float height);
void uart_send_threshold_config(float lv1, float lv2, float lv3);

/* ═══════════════════════════════════════════════════════════
 *  UI_APP.CPP — Shared state & UART stubs
 * ═══════════════════════════════════════════════════════════ */
void ui_app_init(void)
{
    /* State is already initialised by the struct literal above. */
}

void uart_send_sensor_config(float water_level, float distance, float height)
{
    (void)water_level;
    (void)distance;
    (void)height;
    /* ─── PLACEHOLDER ─── */
}

void uart_send_threshold_config(float lv1, float lv2, float lv3)
{
    (void)lv1;
    (void)lv2;
    (void)lv3;
    /* ─── PLACEHOLDER ─── */
}

/* ═══════════════════════════════════════════════════════════
 *  UI_MAIN_SCREEN.CPP — Main Dashboard Screen
 * ═══════════════════════════════════════════════════════════ */
static lv_obj_t *bar_water   = nullptr;
static lv_obj_t *lbl_current = nullptr;
static lv_obj_t *lbl_sensor  = nullptr;
static lv_obj_t *lbl_pump1   = nullptr;
static lv_obj_t *lbl_pump2   = nullptr;
static lv_obj_t *lbl_mode    = nullptr;

#define BAR_WRAPPER_W       54
#define BAR_WRAPPER_H       190
#define PUMP_COL_W          90
#define INFO_COL_W          130

static lv_obj_t *make_panel(lv_obj_t *parent)
{
    lv_obj_t *p = lv_obj_create(parent);
    lv_obj_remove_style_all(p);
    lv_obj_set_style_bg_color(p, CLR_BG_INNER, 0);
    lv_obj_set_style_bg_opa(p, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(p, 10, 0);
    lv_obj_set_style_pad_all(p, 8, 0);
    lv_obj_set_style_border_width(p, 0, 0);
    lv_obj_clear_flag(p, LV_OBJ_FLAG_SCROLLABLE);
    return p;
}

static void add_threshold_mark(lv_obj_t *bar_wrapper,
                                const char *tag,
                                const char *value_text,
                                uint8_t pct_from_bottom,
                                lv_color_t color)
{
    lv_obj_t *line = lv_obj_create(bar_wrapper);
    lv_obj_remove_style_all(line);
    lv_obj_set_size(line, BAR_WRAPPER_W - 4, 1);
    lv_obj_set_style_bg_color(line, color, 0);
    lv_obj_set_style_bg_opa(line, LV_OPA_COVER, 0);
    lv_obj_set_pos(line, 2,
                   BAR_WRAPPER_H - (BAR_WRAPPER_H * pct_from_bottom / 100));
    lv_obj_clear_flag(line, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);

    lv_obj_t *lbl = lv_label_create(bar_wrapper);
    lv_label_set_text_fmt(lbl, "%s %s", tag, value_text);
    lv_obj_set_style_text_color(lbl, color, 0);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_12, 0);
    lv_obj_align_to(lbl, line, LV_ALIGN_OUT_RIGHT_MID, 4, 0);
    lv_obj_clear_flag(lbl, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
}

static void evt_settings_btn(lv_event_t *e);
static void evt_nav_main(lv_event_t *e);
static void evt_nav_settings(lv_event_t *e);
static void evt_close(lv_event_t *e);
static void evt_nav_main_from_settings(lv_event_t *e);

void ui_main_screen_create(void)
{
    ui_main_screen = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(ui_main_screen, CLR_BG_SCREEN, 0);
    lv_obj_set_style_bg_opa(ui_main_screen, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(ui_main_screen, 10, 0);
    lv_obj_set_layout(ui_main_screen, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(ui_main_screen, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(ui_main_screen,
                          LV_FLEX_ALIGN_START,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_size(ui_main_screen, DISP_HOR_RES, DISP_VER_RES);
    lv_obj_clear_flag(ui_main_screen, LV_OBJ_FLAG_SCROLLABLE);

    /* ══════════════════════════════════════════════
     *  HEADER  — title | mode badge | settings btn
     * ══════════════════════════════════════════════ */
    lv_obj_t *header = lv_obj_create(ui_main_screen);
    lv_obj_remove_style_all(header);
    lv_obj_set_size(header, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_layout(header, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(header, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(header,
                          LV_FLEX_ALIGN_START,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_bottom(header, 6, 0);
    lv_obj_set_style_border_width(header, 1, 0);
    lv_obj_set_style_border_color(header, CLR_BORDER, 0);
    lv_obj_set_style_border_side(header, LV_BORDER_SIDE_BOTTOM, 0);
    lv_obj_set_style_pad_column(header, 6, 0);
    lv_obj_clear_flag(header, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *lbl_title = lv_label_create(header);
    lv_label_set_text(lbl_title, LV_SYMBOL_CHARGE " WATER GATE 1");
    lv_obj_set_style_text_color(lbl_title, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(lbl_title, &lv_font_montserrat_14, 0);

    lv_obj_t *spacer = lv_obj_create(header);
    lv_obj_remove_style_all(spacer);
    lv_obj_set_flex_grow(spacer, 1);
    lv_obj_set_size(spacer, 0, 0);
    lv_obj_clear_flag(spacer, LV_OBJ_FLAG_SCROLLABLE);

    lbl_mode = lv_label_create(header);
    lv_label_set_text(lbl_mode, "AUTO");
    lv_obj_set_style_text_color(lbl_mode, CLR_BG_SCREEN, 0);
    lv_obj_set_style_text_font(lbl_mode, &lv_font_montserrat_12, 0);
    lv_obj_set_style_bg_color(lbl_mode, CLR_ORANGE, 0);
    lv_obj_set_style_bg_opa(lbl_mode, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(lbl_mode, 10, 0);
    lv_obj_set_style_pad_top(lbl_mode, 2, 0);
    lv_obj_set_style_pad_bottom(lbl_mode, 2, 0);
    lv_obj_set_style_pad_left(lbl_mode, 10, 0);
    lv_obj_set_style_pad_right(lbl_mode, 10, 0);

    lv_obj_t *btn_settings = lv_btn_create(header);
    lv_obj_set_size(btn_settings, 28, 28);
    lv_obj_set_style_bg_color(btn_settings, CLR_BORDER, 0);
    lv_obj_set_style_bg_opa(btn_settings, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(btn_settings, 6, 0);
    lv_obj_set_style_shadow_width(btn_settings, 0, 0);
    lv_obj_set_style_border_width(btn_settings, 0, 0);
    lv_obj_add_event_cb(btn_settings, evt_settings_btn,
                        LV_EVENT_CLICKED, NULL);

    lv_obj_t *lbl_gear = lv_label_create(btn_settings);
    lv_label_set_text(lbl_gear, LV_SYMBOL_SETTINGS);
    lv_obj_set_style_text_color(lbl_gear, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(lbl_gear, &lv_font_montserrat_14, 0);
    lv_obj_center(lbl_gear);

    /* ══════════════════════════════════════════════
     *  MAIN CONTENT — 3 columns
     * ══════════════════════════════════════════════ */
    lv_obj_t *content = lv_obj_create(ui_main_screen);
    lv_obj_remove_style_all(content);
    lv_obj_set_size(content, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_flex_grow(content, 1);
    lv_obj_set_layout(content, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(content, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(content,
                          LV_FLEX_ALIGN_START,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(content, 10, 0);
    lv_obj_clear_flag(content, LV_OBJ_FLAG_SCROLLABLE);

    /* ─────── Column 1 : Water Level Bar ─────── */
    lv_obj_t *col_bar = make_panel(content);
    lv_obj_set_flex_grow(col_bar, 1);
    lv_obj_set_layout(col_bar, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(col_bar, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(col_bar,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);

    lv_obj_t *bar_wrapper = lv_obj_create(col_bar);
    lv_obj_remove_style_all(bar_wrapper);
    lv_obj_set_size(bar_wrapper, BAR_WRAPPER_W + 70, BAR_WRAPPER_H);
    lv_obj_set_style_bg_color(bar_wrapper, CLR_BG_BAR_TRACK, 0);
    lv_obj_set_style_bg_opa(bar_wrapper, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(bar_wrapper, 6, 0);
    lv_obj_set_style_pad_all(bar_wrapper, 0, 0);
    lv_obj_clear_flag(bar_wrapper, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_clip_corner(bar_wrapper, true, 0);

    bar_water = lv_bar_create(bar_wrapper);
    lv_obj_set_size(bar_water, BAR_WRAPPER_W, BAR_WRAPPER_H);
    lv_obj_align(bar_water, LV_ALIGN_LEFT_MID, 0, 0);
    lv_bar_set_range(bar_water, 0, 100);

    lv_obj_set_style_bg_color(bar_water, CLR_BAR_START, LV_PART_INDICATOR);
    lv_obj_set_style_bg_grad_color(bar_water, CLR_ACCENT, LV_PART_INDICATOR);
    lv_obj_set_style_bg_grad_dir(bar_water, LV_GRAD_DIR_VER, LV_PART_INDICATOR);
    lv_obj_set_style_radius(bar_water, 4, LV_PART_INDICATOR);

    lv_obj_set_style_bg_color(bar_water, CLR_BG_BAR_TRACK, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(bar_water, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_radius(bar_water, 6, LV_PART_MAIN);

    lv_bar_set_value(bar_water,
                     WATER_LEVEL_PCT(app_state.water_level), LV_ANIM_OFF);

    add_threshold_mark(bar_wrapper, "Lv3", "1.80m", 72, CLR_ORANGE);
    add_threshold_mark(bar_wrapper, "Lv2", "1.50m", 50, CLR_ORANGE);
    add_threshold_mark(bar_wrapper, "Lv1", "0.80m", 28, CLR_ORANGE);

    /* ─────── Column 2 : Pump Status ─────── */
    lv_obj_t *col_pump = lv_obj_create(content);
    lv_obj_remove_style_all(col_pump);
    lv_obj_set_width(col_pump, PUMP_COL_W);
    lv_obj_set_layout(col_pump, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(col_pump, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(col_pump,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(col_pump, 8, 0);
    lv_obj_clear_flag(col_pump, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *box_p1 = make_panel(col_pump);
    lv_obj_set_flex_grow(box_p1, 1);
    lv_obj_set_width(box_p1, lv_pct(100));
    lv_obj_set_layout(box_p1, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(box_p1, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(box_p1,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_all(box_p1, 6, 0);

    lv_obj_t *lbl_p1_tag = lv_label_create(box_p1);
    lv_label_set_text(lbl_p1_tag, "PUMP 1");
    lv_obj_set_style_text_color(lbl_p1_tag, CLR_TEXT_LABEL, 0);
    lv_obj_set_style_text_font(lbl_p1_tag, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_letter_space(lbl_p1_tag, 1, 0);

    lbl_pump1 = lv_label_create(box_p1);
    lv_label_set_text(lbl_pump1, "RUN");
    lv_obj_set_style_text_color(lbl_pump1, CLR_GREEN, 0);
    lv_obj_set_style_text_font(lbl_pump1, &lv_font_montserrat_14, 0);
    lv_obj_set_style_bg_color(lbl_pump1, CLR_GREEN_BG, 0);
    lv_obj_set_style_bg_opa(lbl_pump1, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(lbl_pump1, 4, 0);
    lv_obj_set_style_pad_top(lbl_pump1, 3, 0);
    lv_obj_set_style_pad_bottom(lbl_pump1, 3, 0);
    lv_obj_set_style_pad_left(lbl_pump1, 12, 0);
    lv_obj_set_style_pad_right(lbl_pump1, 12, 0);

    lv_obj_t *box_p2 = make_panel(col_pump);
    lv_obj_set_flex_grow(box_p2, 1);
    lv_obj_set_width(box_p2, lv_pct(100));
    lv_obj_set_layout(box_p2, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(box_p2, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(box_p2,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_all(box_p2, 6, 0);

    lv_obj_t *lbl_p2_tag = lv_label_create(box_p2);
    lv_label_set_text(lbl_p2_tag, "PUMP 2");
    lv_obj_set_style_text_color(lbl_p2_tag, CLR_TEXT_LABEL, 0);
    lv_obj_set_style_text_font(lbl_p2_tag, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_letter_space(lbl_p2_tag, 1, 0);

    lbl_pump2 = lv_label_create(box_p2);
    lv_label_set_text(lbl_pump2, "STOP");
    lv_obj_set_style_text_color(lbl_pump2, CLR_GRAY, 0);
    lv_obj_set_style_text_font(lbl_pump2, &lv_font_montserrat_14, 0);
    lv_obj_set_style_bg_color(lbl_pump2, CLR_GRAY_BG, 0);
    lv_obj_set_style_bg_opa(lbl_pump2, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(lbl_pump2, 4, 0);
    lv_obj_set_style_pad_top(lbl_pump2, 3, 0);
    lv_obj_set_style_pad_bottom(lbl_pump2, 3, 0);
    lv_obj_set_style_pad_left(lbl_pump2, 12, 0);
    lv_obj_set_style_pad_right(lbl_pump2, 12, 0);

    /* ─────── Column 3 : Info Panel ─────── */
    lv_obj_t *col_info = lv_obj_create(content);
    lv_obj_remove_style_all(col_info);
    lv_obj_set_width(col_info, INFO_COL_W);
    lv_obj_set_layout(col_info, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(col_info, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(col_info,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(col_info, 8, 0);
    lv_obj_clear_flag(col_info, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *box_cur = make_panel(col_info);
    lv_obj_set_flex_grow(box_cur, 1);
    lv_obj_set_width(box_cur, lv_pct(100));
    lv_obj_set_layout(box_cur, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(box_cur, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(box_cur,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);

    lv_obj_t *lbl_cur_tag = lv_label_create(box_cur);
    lv_label_set_text(lbl_cur_tag, "CURRENT");
    lv_obj_set_style_text_color(lbl_cur_tag, CLR_TEXT_LABEL, 0);
    lv_obj_set_style_text_font(lbl_cur_tag, &lv_font_montserrat_12, 0);

    lbl_current = lv_label_create(box_cur);
    lv_label_set_text_fmt(lbl_current, "%.2f", app_state.water_level);
    lv_obj_set_style_text_color(lbl_current, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(lbl_current, &lv_font_montserrat_22, 0);

    lv_obj_t *lbl_cur_u = lv_label_create(box_cur);
    lv_label_set_text(lbl_cur_u, "meters");
    lv_obj_set_style_text_color(lbl_cur_u, CLR_TEXT_DIM, 0);
    lv_obj_set_style_text_font(lbl_cur_u, &lv_font_montserrat_12, 0);

    lv_obj_t *box_sen = make_panel(col_info);
    lv_obj_set_flex_grow(box_sen, 1);
    lv_obj_set_width(box_sen, lv_pct(100));
    lv_obj_set_layout(box_sen, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(box_sen, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(box_sen,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);

    lv_obj_t *lbl_sen_tag = lv_label_create(box_sen);
    lv_label_set_text(lbl_sen_tag, "SENSOR");
    lv_obj_set_style_text_color(lbl_sen_tag, CLR_TEXT_LABEL, 0);
    lv_obj_set_style_text_font(lbl_sen_tag, &lv_font_montserrat_12, 0);

    lbl_sensor = lv_label_create(box_sen);
    lv_label_set_text_fmt(lbl_sensor, "%.2f", app_state.sensor_height);
    lv_obj_set_style_text_color(lbl_sensor, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(lbl_sensor, &lv_font_montserrat_20, 0);

    lv_obj_t *lbl_sen_u = lv_label_create(box_sen);
    lv_label_set_text(lbl_sen_u, "m height");
    lv_obj_set_style_text_color(lbl_sen_u, CLR_TEXT_DIM, 0);
    lv_obj_set_style_text_font(lbl_sen_u, &lv_font_montserrat_12, 0);

    /* ══════════════════════════════════════════════
     *  BOTTOM NAVIGATION
     * ══════════════════════════════════════════════ */
    lv_obj_t *nav = lv_obj_create(ui_main_screen);
    lv_obj_remove_style_all(nav);
    lv_obj_set_size(nav, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_layout(nav, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(nav, LV_FLEX_FLOW_ROW);
    lv_obj_set_style_pad_column(nav, 8, 0);
    lv_obj_set_style_pad_top(nav, 4, 0);
    lv_obj_clear_flag(nav, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *btn_nav_main = lv_btn_create(nav);
    lv_obj_set_flex_grow(btn_nav_main, 1);
    lv_obj_set_style_min_height(btn_nav_main, 36, 0);
    lv_obj_set_style_bg_color(btn_nav_main, CLR_ACCENT, 0);
    lv_obj_set_style_bg_opa(btn_nav_main, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(btn_nav_main, 8, 0);
    lv_obj_set_style_shadow_width(btn_nav_main, 0, 0);
    lv_obj_set_style_border_color(btn_nav_main, CLR_ACCENT, 0);
    lv_obj_set_style_border_width(btn_nav_main, 1, 0);
    lv_obj_add_event_cb(btn_nav_main, evt_nav_main,
                        LV_EVENT_CLICKED, NULL);

    lv_obj_t *lnm = lv_label_create(btn_nav_main);
    lv_label_set_text(lnm, LV_SYMBOL_IMAGE " Main");
    lv_obj_set_style_text_color(lnm, CLR_BG_SCREEN, 0);
    lv_obj_set_style_text_font(lnm, &lv_font_montserrat_14, 0);
    lv_obj_center(lnm);

    lv_obj_t *btn_nav_set = lv_btn_create(nav);
    lv_obj_set_flex_grow(btn_nav_set, 1);
    lv_obj_set_style_min_height(btn_nav_set, 36, 0);
    lv_obj_set_style_bg_color(btn_nav_set, CLR_BORDER, 0);
    lv_obj_set_style_bg_opa(btn_nav_set, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(btn_nav_set, 8, 0);
    lv_obj_set_style_shadow_width(btn_nav_set, 0, 0);
    lv_obj_set_style_border_color(btn_nav_set, CLR_ACCENT, 0);
    lv_obj_set_style_border_width(btn_nav_set, 1, 0);
    lv_obj_add_event_cb(btn_nav_set, evt_nav_settings,
                        LV_EVENT_CLICKED, NULL);

    lv_obj_t *lns = lv_label_create(btn_nav_set);
    lv_label_set_text(lns, LV_SYMBOL_SETTINGS " Settings");
    lv_obj_set_style_text_color(lns, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(lns, &lv_font_montserrat_14, 0);
    lv_obj_center(lns);
}

void ui_main_screen_refresh(void)
{
    char buf[16];

    lv_bar_set_value(bar_water,
                     WATER_LEVEL_PCT(app_state.water_level), LV_ANIM_ON);

    snprintf(buf, sizeof(buf), "%.2f", app_state.water_level);
    lv_label_set_text(lbl_current, buf);

    snprintf(buf, sizeof(buf), "%.2f", app_state.sensor_height);
    lv_label_set_text(lbl_sensor, buf);

    if (app_state.pump1 == PUMP_RUN) {
        lv_label_set_text(lbl_pump1, "RUN");
        lv_obj_set_style_text_color(lbl_pump1, CLR_GREEN, 0);
        lv_obj_set_style_bg_color(lbl_pump1, CLR_GREEN_BG, 0);
    } else {
        lv_label_set_text(lbl_pump1, "STOP");
        lv_obj_set_style_text_color(lbl_pump1, CLR_GRAY, 0);
        lv_obj_set_style_bg_color(lbl_pump1, CLR_GRAY_BG, 0);
    }

    if (app_state.pump2 == PUMP_RUN) {
        lv_label_set_text(lbl_pump2, "RUN");
        lv_obj_set_style_text_color(lbl_pump2, CLR_GREEN, 0);
        lv_obj_set_style_bg_color(lbl_pump2, CLR_GREEN_BG, 0);
    } else {
        lv_label_set_text(lbl_pump2, "STOP");
        lv_obj_set_style_text_color(lbl_pump2, CLR_GRAY, 0);
        lv_obj_set_style_bg_color(lbl_pump2, CLR_GRAY_BG, 0);
    }

    if (app_state.mode == MODE_AUTO) {
        lv_label_set_text(lbl_mode, "AUTO");
        lv_obj_set_style_bg_color(lbl_mode, CLR_ORANGE, 0);
    } else {
        lv_label_set_text(lbl_mode, "MANUAL");
        lv_obj_set_style_bg_color(lbl_mode, CLR_ACCENT, 0);
    }

    app_state.data_updated = false;
}

static void evt_settings_btn(lv_event_t *e)
{
    (void)e;
    lv_scr_load_anim(ui_settings_screen, LV_SCR_LOAD_ANIM_FADE_ON,
                     300, 0, false);
}

static void evt_nav_main(lv_event_t *e)
{
    (void)e;
}

static void evt_nav_settings(lv_event_t *e)
{
    (void)e;
    lv_scr_load_anim(ui_settings_screen, LV_SCR_LOAD_ANIM_FADE_ON,
                     300, 0, false);
}

/* ═══════════════════════════════════════════════════════════
 *  UI_SETTINGS_SCREEN.CPP — Settings Screen + Sub-pages
 * ═══════════════════════════════════════════════════════════ */
static lv_obj_t *page_menu      = nullptr;
static lv_obj_t *page_sensor    = nullptr;
static lv_obj_t *page_threshold = nullptr;

typedef struct {
    float  *value;
    float   step;
    float   min_val;
    float   max_val;
    lv_obj_t *label;
} stepper_ctx_t;

static stepper_ctx_t ctx_water_level;
static stepper_ctx_t ctx_distance;
static stepper_ctx_t ctx_height;
static stepper_ctx_t ctx_thr_lv1;
static stepper_ctx_t ctx_thr_lv2;
static stepper_ctx_t ctx_thr_lv3;

static float s_water = 1.25f;
static float s_dist  = 1.25f;
static float s_lv1   = 0.80f;
static float s_lv2   = 1.50f;
static float s_lv3   = 1.80f;

static void show_page(lv_obj_t *target)
{
    lv_obj_clear_flag(target, LV_OBJ_FLAG_HIDDEN);
    if (target != page_menu)      lv_obj_add_flag(page_menu,      LV_OBJ_FLAG_HIDDEN);
    if (target != page_sensor)    lv_obj_add_flag(page_sensor,    LV_OBJ_FLAG_HIDDEN);
    if (target != page_threshold) lv_obj_add_flag(page_threshold, LV_OBJ_FLAG_HIDDEN);
}

static lv_obj_t *make_header(lv_obj_t *parent,
                              const char *title,
                              lv_event_cb_t btn_cb,
                              const char *btn_symbol)
{
    lv_obj_t *hdr = lv_obj_create(parent);
    lv_obj_remove_style_all(hdr);
    lv_obj_set_size(hdr, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_layout(hdr, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(hdr, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(hdr,
                          LV_FLEX_ALIGN_START,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_bottom(hdr, 6, 0);
    lv_obj_set_style_border_width(hdr, 1, 0);
    lv_obj_set_style_border_color(hdr, CLR_BORDER, 0);
    lv_obj_set_style_border_side(hdr, LV_BORDER_SIDE_BOTTOM, 0);
    lv_obj_set_style_pad_column(hdr, 6, 0);
    lv_obj_clear_flag(hdr, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *lbl = lv_label_create(hdr);
    lv_label_set_text(lbl, title);
    lv_obj_set_style_text_color(lbl, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_14, 0);

    lv_obj_t *sp = lv_obj_create(hdr);
    lv_obj_remove_style_all(sp);
    lv_obj_set_flex_grow(sp, 1);
    lv_obj_set_size(sp, 0, 0);
    lv_obj_clear_flag(sp, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *btn = lv_btn_create(hdr);
    lv_obj_set_size(btn, 28, 28);
    lv_obj_set_style_bg_color(btn, CLR_BORDER, 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(btn, 6, 0);
    lv_obj_set_style_shadow_width(btn, 0, 0);
    lv_obj_set_style_border_width(btn, 0, 0);
    lv_obj_add_event_cb(btn, btn_cb, LV_EVENT_CLICKED, NULL);

    lv_obj_t *btxt = lv_label_create(btn);
    lv_label_set_text(btxt, btn_symbol);
    lv_obj_set_style_text_color(btxt, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(btxt, &lv_font_montserrat_14, 0);
    lv_obj_center(btxt);

    return hdr;
}

static lv_obj_t *make_nav(lv_obj_t *parent, bool settings_active)
{
    lv_obj_t *nav = lv_obj_create(parent);
    lv_obj_remove_style_all(nav);
    lv_obj_set_size(nav, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_layout(nav, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(nav, LV_FLEX_FLOW_ROW);
    lv_obj_set_style_pad_column(nav, 8, 0);
    lv_obj_set_style_pad_top(nav, 4, 0);
    lv_obj_clear_flag(nav, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *b1 = lv_btn_create(nav);
    lv_obj_set_flex_grow(b1, 1);
    lv_obj_set_style_min_height(b1, 36, 0);
    lv_obj_set_style_bg_color(b1, settings_active ? CLR_BORDER : CLR_ACCENT, 0);
    lv_obj_set_style_bg_opa(b1, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(b1, 8, 0);
    lv_obj_set_style_shadow_width(b1, 0, 0);
    lv_obj_set_style_border_color(b1, CLR_ACCENT, 0);
    lv_obj_set_style_border_width(b1, 1, 0);
    lv_obj_add_event_cb(b1, evt_nav_main_from_settings, LV_EVENT_CLICKED, NULL);

    lv_obj_t *t1 = lv_label_create(b1);
    lv_label_set_text(t1, LV_SYMBOL_IMAGE " Main");
    lv_obj_set_style_text_color(t1, settings_active ? CLR_ACCENT : CLR_BG_SCREEN, 0);
    lv_obj_set_style_text_font(t1, &lv_font_montserrat_14, 0);
    lv_obj_center(t1);

    lv_obj_t *b2 = lv_btn_create(nav);
    lv_obj_set_flex_grow(b2, 1);
    lv_obj_set_style_min_height(b2, 36, 0);
    lv_obj_set_style_bg_color(b2, settings_active ? CLR_ACCENT : CLR_BORDER, 0);
    lv_obj_set_style_bg_opa(b2, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(b2, 8, 0);
    lv_obj_set_style_shadow_width(b2, 0, 0);
    lv_obj_set_style_border_color(b2, CLR_ACCENT, 0);
    lv_obj_set_style_border_width(b2, 1, 0);

    lv_obj_t *t2 = lv_label_create(b2);
    lv_label_set_text(t2, LV_SYMBOL_SETTINGS " Settings");
    lv_obj_set_style_text_color(t2, settings_active ? CLR_BG_SCREEN : CLR_ACCENT, 0);
    lv_obj_set_style_text_font(t2, &lv_font_montserrat_14, 0);
    lv_obj_center(t2);

    return nav;
}

static void evt_back_to_menu(lv_event_t *e);
static void evt_sensor_setup(lv_event_t *e);
static void evt_threshold_setup(lv_event_t *e);
static void evt_save_sensor(lv_event_t *e);
static void evt_save_threshold(lv_event_t *e);
static void evt_cancel(lv_event_t *e);
static void evt_step_minus(lv_event_t *e);
static void evt_step_plus(lv_event_t *e);

static void make_stepper_row(lv_obj_t *parent,
                              lv_color_t dot_color,
                              const char *row_label,
                              stepper_ctx_t *ctx,
                              float init_val,
                              float step,
                              float min_v,
                              float max_v,
                              bool readonly)
{
    lv_obj_t *row = make_panel(parent);
    lv_obj_set_width(row, lv_pct(100));
    lv_obj_set_height(row, LV_SIZE_CONTENT);
    lv_obj_set_layout(row, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(row, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(row,
                          LV_FLEX_ALIGN_START,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(row, 8, 0);
    lv_obj_set_style_pad_all(row, 6, 0);

    lv_obj_t *dot = lv_obj_create(row);
    lv_obj_remove_style_all(dot);
    lv_obj_set_size(dot, 8, 8);
    lv_obj_set_style_bg_color(dot, dot_color, 0);
    lv_obj_set_style_bg_opa(dot, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(dot, LV_RADIUS_CIRCLE, 0);
    lv_obj_clear_flag(dot, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *lbl = lv_label_create(row);
    lv_label_set_text(lbl, row_label);
    lv_obj_set_style_text_color(lbl, CLR_TEXT_LABEL, 0);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_14, 0);
    lv_obj_set_style_min_width(lbl, 100, 0);

    lv_obj_t *sp = lv_obj_create(row);
    lv_obj_remove_style_all(sp);
    lv_obj_set_flex_grow(sp, 1);
    lv_obj_set_size(sp, 0, 0);
    lv_obj_clear_flag(sp, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *btn_m = lv_btn_create(row);
    lv_obj_set_size(btn_m, 34, 34);
    lv_obj_set_style_bg_color(btn_m, CLR_BORDER, 0);
    lv_obj_set_style_bg_opa(btn_m, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(btn_m, 8, 0);
    lv_obj_set_style_shadow_width(btn_m, 0, 0);
    lv_obj_set_style_border_width(btn_m, 0, 0);
    if (readonly) lv_obj_add_flag(btn_m, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(btn_m, evt_step_minus, LV_EVENT_CLICKED, ctx);

    lv_obj_t *tm = lv_label_create(btn_m);
    lv_label_set_text(tm, "-");
    lv_obj_set_style_text_color(tm, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(tm, &lv_font_montserrat_16, 0);
    lv_obj_center(tm);

    lv_obj_t *val_lbl = lv_obj_create(row);
    lv_obj_remove_style_all(val_lbl);
    lv_obj_set_size(val_lbl, 64, 34);
    lv_obj_set_style_bg_color(val_lbl, CLR_BG_BAR_TRACK, 0);
    lv_obj_set_style_bg_opa(val_lbl, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(val_lbl, 6, 0);
    lv_obj_set_style_border_color(val_lbl, CLR_BORDER, 0);
    lv_obj_set_style_border_width(val_lbl, 1, 0);
    lv_obj_set_style_text_color(val_lbl, readonly ? CLR_TEXT_DIM : CLR_ACCENT, 0);
    lv_obj_set_style_text_font(val_lbl, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_align(val_lbl, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_clear_flag(val_lbl, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *vtxt = lv_label_create(val_lbl);
    char vbuf[16];
    snprintf(vbuf, sizeof(vbuf), "%.2f", init_val);
    lv_label_set_text(vtxt, vbuf);
    lv_obj_center(vtxt);

    lv_obj_t *btn_p = lv_btn_create(row);
    lv_obj_set_size(btn_p, 34, 34);
    lv_obj_set_style_bg_color(btn_p, CLR_BORDER, 0);
    lv_obj_set_style_bg_opa(btn_p, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(btn_p, 8, 0);
    lv_obj_set_style_shadow_width(btn_p, 0, 0);
    lv_obj_set_style_border_width(btn_p, 0, 0);
    if (readonly) lv_obj_add_flag(btn_p, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(btn_p, evt_step_plus, LV_EVENT_CLICKED, ctx);

    lv_obj_t *tp = lv_label_create(btn_p);
    lv_label_set_text(tp, "+");
    lv_obj_set_style_text_color(tp, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(tp, &lv_font_montserrat_16, 0);
    lv_obj_center(tp);

    lv_obj_t *unit = lv_label_create(row);
    lv_label_set_text(unit, "m");
    lv_obj_set_style_text_color(unit, CLR_TEXT_DIM, 0);
    lv_obj_set_style_text_font(unit, &lv_font_montserrat_14, 0);

    float *storage = nullptr;
    if      (ctx == &ctx_water_level) { s_water = init_val; storage = &s_water; }
    else if (ctx == &ctx_distance)    { s_dist  = init_val; storage = &s_dist;  }
    else if (ctx == &ctx_height)      { storage = &s_water; }
    else if (ctx == &ctx_thr_lv1)     { s_lv1   = init_val; storage = &s_lv1;   }
    else if (ctx == &ctx_thr_lv2)     { s_lv2   = init_val; storage = &s_lv2;   }
    else                              { s_lv3   = init_val; storage = &s_lv3;   }

    ctx->value   = storage;
    ctx->step    = step;
    ctx->min_val = min_v;
    ctx->max_val = max_v;
    ctx->label   = vtxt;
}

void ui_settings_screen_create(void)
{
    ui_settings_screen = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(ui_settings_screen, CLR_BG_SCREEN, 0);
    lv_obj_set_style_bg_opa(ui_settings_screen, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(ui_settings_screen, 10, 0);
    lv_obj_set_layout(ui_settings_screen, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(ui_settings_screen, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(ui_settings_screen,
                          LV_FLEX_ALIGN_START,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_size(ui_settings_screen, DISP_HOR_RES, DISP_VER_RES);
    lv_obj_clear_flag(ui_settings_screen, LV_OBJ_FLAG_SCROLLABLE);

    /* ══════════════════════════════════════════════
     *  PAGE 1: Settings Menu
     * ══════════════════════════════════════════════ */
    page_menu = lv_obj_create(ui_settings_screen);
    lv_obj_remove_style_all(page_menu);
    lv_obj_set_size(page_menu, lv_pct(100), lv_pct(100));
    lv_obj_set_layout(page_menu, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(page_menu, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(page_menu,
                          LV_FLEX_ALIGN_START,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(page_menu, 6, 0);
    lv_obj_clear_flag(page_menu, LV_OBJ_FLAG_SCROLLABLE);

    make_header(page_menu, LV_SYMBOL_SETTINGS " SETTINGS",
                evt_close, LV_SYMBOL_CLOSE);

    lv_obj_t *grid = lv_obj_create(page_menu);
    lv_obj_remove_style_all(grid);
    lv_obj_set_size(grid, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_flex_grow(grid, 1);
    lv_obj_set_layout(grid, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(grid, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(grid,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(grid, 12, 0);
    lv_obj_clear_flag(grid, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *mb1 = lv_btn_create(grid);
    lv_obj_set_flex_grow(mb1, 1);
    lv_obj_set_style_min_height(mb1, 140, 0);
    lv_obj_set_style_bg_color(mb1, CLR_BG_INNER, 0);
    lv_obj_set_style_bg_opa(mb1, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_grad_color(mb1, lv_color_hex(0x252550), 0);
    lv_obj_set_style_bg_grad_dir(mb1, LV_GRAD_DIR_VER, 0);
    lv_obj_set_style_radius(mb1, 14, 0);
    lv_obj_set_style_border_color(mb1, CLR_BORDER, 0);
    lv_obj_set_style_border_width(mb1, 2, 0);
    lv_obj_set_style_shadow_width(mb1, 0, 0);
    lv_obj_set_style_pad_all(mb1, 12, 0);
    lv_obj_add_event_cb(mb1, evt_sensor_setup, LV_EVENT_CLICKED, NULL);
    lv_obj_set_style_border_side(mb1, LV_BORDER_SIDE_FULL, 0);

    lv_obj_t *mb1c = lv_obj_create(mb1);
    lv_obj_remove_style_all(mb1c);
    lv_obj_set_size(mb1c, lv_pct(100), lv_pct(100));
    lv_obj_set_layout(mb1c, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(mb1c, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(mb1c,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_clear_flag(mb1c, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *mi1 = lv_label_create(mb1c);
    lv_label_set_text(mi1, LV_SYMBOL_WIFI);
    lv_obj_set_style_text_font(mi1, &lv_font_montserrat_28, 0);
    lv_obj_set_style_text_color(mi1, CLR_ACCENT, 0);

    lv_obj_t *mt1 = lv_label_create(mb1c);
    lv_label_set_text(mt1, "Sensor Setup");
    lv_obj_set_style_text_font(mt1, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(mt1, CLR_TEXT_WHITE, 0);

    lv_obj_t *md1 = lv_label_create(mb1c);
    lv_label_set_text(md1, "Set sensor range");
    lv_obj_set_style_text_font(md1, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(md1, CLR_TEXT_LABEL, 0);

    lv_obj_t *mb2 = lv_btn_create(grid);
    lv_obj_set_flex_grow(mb2, 1);
    lv_obj_set_style_min_height(mb2, 140, 0);
    lv_obj_set_style_bg_color(mb2, CLR_BG_INNER, 0);
    lv_obj_set_style_bg_opa(mb2, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_grad_color(mb2, lv_color_hex(0x252550), 0);
    lv_obj_set_style_bg_grad_dir(mb2, LV_GRAD_DIR_VER, 0);
    lv_obj_set_style_radius(mb2, 14, 0);
    lv_obj_set_style_border_color(mb2, CLR_BORDER, 0);
    lv_obj_set_style_border_width(mb2, 2, 0);
    lv_obj_set_style_shadow_width(mb2, 0, 0);
    lv_obj_set_style_pad_all(mb2, 12, 0);
    lv_obj_add_event_cb(mb2, evt_threshold_setup, LV_EVENT_CLICKED, NULL);

    lv_obj_t *mb2c = lv_obj_create(mb2);
    lv_obj_remove_style_all(mb2c);
    lv_obj_set_size(mb2c, lv_pct(100), lv_pct(100));
    lv_obj_set_layout(mb2c, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(mb2c, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(mb2c,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER,
                          LV_FLEX_ALIGN_CENTER);
    lv_obj_clear_flag(mb2c, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *mi2 = lv_label_create(mb2c);
    lv_label_set_text(mi2, LV_SYMBOL_IMAGE);
    lv_obj_set_style_text_font(mi2, &lv_font_montserrat_28, 0);
    lv_obj_set_style_text_color(mi2, CLR_ORANGE, 0);

    lv_obj_t *mt2 = lv_label_create(mb2c);
    lv_label_set_text(mt2, "Threshold Setup");
    lv_obj_set_style_text_font(mt2, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(mt2, CLR_TEXT_WHITE, 0);

    lv_obj_t *md2 = lv_label_create(mb2c);
    lv_label_set_text(md2, "Set 3 water levels");
    lv_obj_set_style_text_font(md2, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(md2, CLR_TEXT_LABEL, 0);

    make_nav(page_menu, true);

    /* ══════════════════════════════════════════════
     *  PAGE 2: Sensor Setup
     * ══════════════════════════════════════════════ */
    page_sensor = lv_obj_create(ui_settings_screen);
    lv_obj_remove_style_all(page_sensor);
    lv_obj_set_size(page_sensor, lv_pct(100), lv_pct(100));
    lv_obj_set_layout(page_sensor, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(page_sensor, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_row(page_sensor, 8, 0);
    lv_obj_clear_flag(page_sensor, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(page_sensor, LV_OBJ_FLAG_HIDDEN);

    make_header(page_sensor, LV_SYMBOL_WIFI " SENSOR SETUP",
                evt_back_to_menu, LV_SYMBOL_LEFT);

    lv_obj_t *slist = lv_obj_create(page_sensor);
    lv_obj_remove_style_all(slist);
    lv_obj_set_size(slist, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_flex_grow(slist, 1);
    lv_obj_set_layout(slist, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(slist, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_row(slist, 8, 0);
    lv_obj_clear_flag(slist, LV_OBJ_FLAG_SCROLLABLE);

    make_stepper_row(slist, CLR_ACCENT, "Water Level",
                     &ctx_water_level,
                     app_state.water_level, 0.01f, 0.0f, 9.99f, false);

    make_stepper_row(slist, CLR_ACCENT, "Distance",
                     &ctx_distance,
                     app_state.distance, 0.01f, 0.0f, 9.99f, false);

    make_stepper_row(slist, CLR_ACCENT, "Sensor Height",
                     &ctx_height,
                     app_state.sensor_height, 0.01f, 0.0f, 9.99f, true);

    lv_obj_t *btns = lv_obj_create(page_sensor);
    lv_obj_remove_style_all(btns);
    lv_obj_set_size(btns, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_layout(btns, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(btns, LV_FLEX_FLOW_ROW);
    lv_obj_set_style_pad_column(btns, 10, 0);
    lv_obj_set_style_pad_top(btns, 4, 0);
    lv_obj_clear_flag(btns, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *bc = lv_btn_create(btns);
    lv_obj_set_flex_grow(bc, 1);
    lv_obj_set_style_min_height(bc, 36, 0);
    lv_obj_set_style_bg_color(bc, CLR_BORDER, 0);
    lv_obj_set_style_bg_opa(bc, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(bc, 8, 0);
    lv_obj_set_style_shadow_width(bc, 0, 0);
    lv_obj_set_style_border_width(bc, 0, 0);
    lv_obj_add_event_cb(bc, evt_cancel, LV_EVENT_CLICKED, NULL);
    lv_obj_t *bct = lv_label_create(bc);
    lv_label_set_text(bct, "Cancel");
    lv_obj_set_style_text_color(bct, CLR_GRAY, 0);
    lv_obj_set_style_text_font(bct, &lv_font_montserrat_14, 0);
    lv_obj_center(bct);

    lv_obj_t *bs = lv_btn_create(btns);
    lv_obj_set_flex_grow(bs, 1);
    lv_obj_set_style_min_height(bs, 36, 0);
    lv_obj_set_style_bg_color(bs, CLR_ACCENT, 0);
    lv_obj_set_style_bg_opa(bs, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(bs, 8, 0);
    lv_obj_set_style_shadow_width(bs, 0, 0);
    lv_obj_set_style_border_width(bs, 0, 0);
    lv_obj_add_event_cb(bs, evt_save_sensor, LV_EVENT_CLICKED, NULL);
    lv_obj_t *bst = lv_label_create(bs);
    lv_label_set_text(bst, LV_SYMBOL_OK " Save");
    lv_obj_set_style_text_color(bst, CLR_BG_SCREEN, 0);
    lv_obj_set_style_text_font(bst, &lv_font_montserrat_14, 0);
    lv_obj_center(bst);

    /* ══════════════════════════════════════════════
     *  PAGE 3: Threshold Setup
     * ══════════════════════════════════════════════ */
    page_threshold = lv_obj_create(ui_settings_screen);
    lv_obj_remove_style_all(page_threshold);
    lv_obj_set_size(page_threshold, lv_pct(100), lv_pct(100));
    lv_obj_set_layout(page_threshold, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(page_threshold, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_row(page_threshold, 8, 0);
    lv_obj_clear_flag(page_threshold, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(page_threshold, LV_OBJ_FLAG_HIDDEN);

    make_header(page_threshold, LV_SYMBOL_IMAGE " THRESHOLD",
                evt_back_to_menu, LV_SYMBOL_LEFT);

    lv_obj_t *tbody = lv_obj_create(page_threshold);
    lv_obj_remove_style_all(tbody);
    lv_obj_set_size(tbody, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_flex_grow(tbody, 1);
    lv_obj_set_layout(tbody, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(tbody, LV_FLEX_FLOW_ROW);
    lv_obj_set_style_pad_column(tbody, 12, 0);
    lv_obj_clear_flag(tbody, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *vis = make_panel(tbody);
    lv_obj_set_style_bg_color(vis, CLR_BG_INNER, 0);
    lv_obj_set_style_radius(vis, 10, 0);
    lv_obj_set_style_pad_all(vis, 8, 0);
    lv_obj_set_width(vis, 70);

    lv_obj_t *mini_bar_bg = lv_obj_create(vis);
    lv_obj_remove_style_all(mini_bar_bg);
    lv_obj_set_size(mini_bar_bg, 40, 160);
    lv_obj_set_style_bg_color(mini_bar_bg, CLR_BG_BAR_TRACK, 0);
    lv_obj_set_style_bg_opa(mini_bar_bg, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(mini_bar_bg, 6, 0);
    lv_obj_clear_flag(mini_bar_bg, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *mini_fill = lv_bar_create(mini_bar_bg);
    lv_obj_set_size(mini_fill, 40, 160);
    lv_bar_set_range(mini_fill, 0, 100);
    lv_bar_set_value(mini_fill,
                     WATER_LEVEL_PCT(app_state.water_level), LV_ANIM_OFF);
    lv_obj_set_style_bg_color(mini_fill, CLR_BG_BAR_TRACK, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(mini_fill, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_radius(mini_fill, 6, LV_PART_MAIN);
    lv_obj_set_style_bg_color(mini_fill, CLR_BAR_START, LV_PART_INDICATOR);
    lv_obj_set_style_bg_grad_color(mini_fill, CLR_ACCENT, LV_PART_INDICATOR);
    lv_obj_set_style_bg_grad_dir(mini_fill, LV_GRAD_DIR_VER, LV_PART_INDICATOR);
    lv_obj_set_style_radius(mini_fill, 4, LV_PART_INDICATOR);

    lv_obj_t *tform = lv_obj_create(tbody);
    lv_obj_remove_style_all(tform);
    lv_obj_set_size(tform, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_flex_grow(tform, 1);
    lv_obj_set_layout(tform, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(tform, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_style_pad_row(tform, 8, 0);
    lv_obj_clear_flag(tform, LV_OBJ_FLAG_SCROLLABLE);

    make_stepper_row(tform, CLR_GREEN,  "Lv1 Stop",
                     &ctx_thr_lv1, app_state.threshold_lv1,
                     0.01f, 0.0f, 9.99f, false);
    make_stepper_row(tform, CLR_ORANGE, "Lv2 Pump1",
                     &ctx_thr_lv2, app_state.threshold_lv2,
                     0.01f, 0.0f, 9.99f, false);
    make_stepper_row(tform, CLR_RED,    "Lv3 Pump1+2",
                     &ctx_thr_lv3, app_state.threshold_lv3,
                     0.01f, 0.0f, 9.99f, false);

    lv_obj_t *tbtns = lv_obj_create(page_threshold);
    lv_obj_remove_style_all(tbtns);
    lv_obj_set_size(tbtns, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_layout(tbtns, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(tbtns, LV_FLEX_FLOW_ROW);
    lv_obj_set_style_pad_column(tbtns, 10, 0);
    lv_obj_set_style_pad_top(tbtns, 4, 0);
    lv_obj_clear_flag(tbtns, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *tc = lv_btn_create(tbtns);
    lv_obj_set_flex_grow(tc, 1);
    lv_obj_set_style_min_height(tc, 36, 0);
    lv_obj_set_style_bg_color(tc, CLR_BORDER, 0);
    lv_obj_set_style_bg_opa(tc, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(tc, 8, 0);
    lv_obj_set_style_shadow_width(tc, 0, 0);
    lv_obj_set_style_border_width(tc, 0, 0);
    lv_obj_add_event_cb(tc, evt_cancel, LV_EVENT_CLICKED, NULL);
    lv_obj_t *tct = lv_label_create(tc);
    lv_label_set_text(tct, "Cancel");
    lv_obj_set_style_text_color(tct, CLR_GRAY, 0);
    lv_obj_set_style_text_font(tct, &lv_font_montserrat_14, 0);
    lv_obj_center(tct);

    lv_obj_t *ts = lv_btn_create(tbtns);
    lv_obj_set_flex_grow(ts, 1);
    lv_obj_set_style_min_height(ts, 36, 0);
    lv_obj_set_style_bg_color(ts, CLR_ACCENT, 0);
    lv_obj_set_style_bg_opa(ts, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(ts, 8, 0);
    lv_obj_set_style_shadow_width(ts, 0, 0);
    lv_obj_set_style_border_width(ts, 0, 0);
    lv_obj_add_event_cb(ts, evt_save_threshold, LV_EVENT_CLICKED, NULL);
    lv_obj_t *tst = lv_label_create(ts);
    lv_label_set_text(tst, LV_SYMBOL_OK " Save");
    lv_obj_set_style_text_color(tst, CLR_BG_SCREEN, 0);
    lv_obj_set_style_text_font(tst, &lv_font_montserrat_14, 0);
    lv_obj_center(tst);
}

static void evt_close(lv_event_t *e)
{
    (void)e;
    lv_scr_load_anim(ui_main_screen, LV_SCR_LOAD_ANIM_FADE_ON,
                     300, 0, false);
}

static void evt_back_to_menu(lv_event_t *e)
{
    (void)e;
    show_page(page_menu);
}

static void evt_sensor_setup(lv_event_t *e)
{
    (void)e;
    show_page(page_sensor);
}

static void evt_threshold_setup(lv_event_t *e)
{
    (void)e;
    show_page(page_threshold);
}

static void evt_cancel(lv_event_t *e)
{
    (void)e;
    show_page(page_menu);
}

static void evt_save_sensor(lv_event_t *e)
{
    (void)e;
    if (ctx_water_level.value)
        app_state.water_level = *ctx_water_level.value;
    if (ctx_distance.value)
        app_state.distance = *ctx_distance.value;
    app_state.sensor_height = app_state.water_level + app_state.distance;

    uart_send_sensor_config(app_state.water_level,
                            app_state.distance,
                            app_state.sensor_height);

    show_page(page_menu);
}

static void evt_save_threshold(lv_event_t *e)
{
    (void)e;
    if (ctx_thr_lv1.value) app_state.threshold_lv1 = *ctx_thr_lv1.value;
    if (ctx_thr_lv2.value) app_state.threshold_lv2 = *ctx_thr_lv2.value;
    if (ctx_thr_lv3.value) app_state.threshold_lv3 = *ctx_thr_lv3.value;

    uart_send_threshold_config(app_state.threshold_lv1,
                               app_state.threshold_lv2,
                               app_state.threshold_lv3);

    show_page(page_menu);
}

static void evt_nav_main_from_settings(lv_event_t *e)
{
    (void)e;
    lv_scr_load_anim(ui_main_screen, LV_SCR_LOAD_ANIM_FADE_ON,
                     300, 0, false);
}

static void evt_step_minus(lv_event_t *e)
{
    stepper_ctx_t *ctx = (stepper_ctx_t *)lv_event_get_user_data(e);
    if (!ctx || !ctx->value || !ctx->label) return;

    float v = *ctx->value - ctx->step;
    if (v < ctx->min_val) v = ctx->min_val;
    *ctx->value = v;

    char buf[16];
    snprintf(buf, sizeof(buf), "%.2f", v);
    lv_label_set_text(ctx->label, buf);
}

static void evt_step_plus(lv_event_t *e)
{
    stepper_ctx_t *ctx = (stepper_ctx_t *)lv_event_get_user_data(e);
    if (!ctx || !ctx->value || !ctx->label) return;

    float v = *ctx->value + ctx->step;
    if (v > ctx->max_val) v = ctx->max_val;
    *ctx->value = v;

    char buf[16];
    snprintf(buf, sizeof(buf), "%.2f", v);
    lv_label_set_text(ctx->label, buf);
}

/* ═══════════════════════════════════════════════════════════
 *  MAIN APPLICATION SETUP & LOOP
 * ═══════════════════════════════════════════════════════════ */
static TFT_eSPI tft = TFT_eSPI();
static lv_disp_draw_buf_t draw_buf;
static lv_color_t buf1[DISP_HOR_RES * LVGL_BUF_ROWS];
static lv_disp_drv_t disp_drv;
static lv_indev_drv_t indev_drv;
static uint32_t last_tick_ms = 0;
#define STM32_SERIAL Serial2

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

static void touch_read_cb(lv_indev_drv_t *indev,
                           lv_indev_data_t *data)
{
    uint16_t x = 0, y = 0;
    bool touched = tft.getTouch(&x, &y, 600);

    if (touched) {
        data->point.x = x;
        data->point.y = y;
        data->state   = LV_INDEV_STATE_PR;
    } else {
        data->state = LV_INDEV_STATE_REL;
    }
}

static void uart_init(void)
{
    STM32_SERIAL.begin(STM32_BAUD, SERIAL_8N1,
                       STM32_RX_PIN, STM32_TX_PIN);
    Serial.println("[UART] Serial2 @ 115200 baud initialized");
}

static void uart_process(void)
{
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
            uint8_t chk = 0xAA ^ 0x55 ^ rx_len ^ rx_cmd;
            for (uint8_t i = 0; i < rx_len; i++) chk ^= rx_buf[i];

            if (chk == b) {
                if (rx_cmd == 0x01 && rx_len >= 13) {
                    memcpy(&app_state.water_level, &rx_buf[0], 4);
                    memcpy(&app_state.distance,    &rx_buf[4], 4);
                    app_state.pump1 = (pump_state_t)rx_buf[8];
                    app_state.pump2 = (pump_state_t)rx_buf[9];
                    app_state.mode  = (op_mode_t)rx_buf[10];
                    app_state.sensor_height = app_state.water_level
                                            + app_state.distance;
                    app_state.data_updated = true;
                }
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

void setup()
{
    Serial.begin(115200);
    Serial.println("\n[HMI] ESP32-S3 Water Gate Controller v1.0");
    Serial.println("[HMI] Initializing...");

    pinMode(TFT_BL, OUTPUT);
    digitalWrite(TFT_BL, HIGH);

    tft.begin();
    tft.setRotation(1);
    tft.fillScreen(TFT_BLACK);
    Serial.println("[HMI] TFT initialized (480x320 landscape)");

    lv_init();

    lv_disp_draw_buf_init(&draw_buf, buf1, NULL,
                          DISP_HOR_RES * LVGL_BUF_ROWS);

    lv_disp_drv_init(&disp_drv);
    disp_drv.hor_res  = DISP_HOR_RES;
    disp_drv.ver_res  = DISP_VER_RES;
    disp_drv.flush_cb = disp_flush_cb;
    disp_drv.draw_buf = &draw_buf;
    lv_disp_drv_register(&disp_drv);

    lv_indev_drv_init(&indev_drv);
    indev_drv.type     = LV_INDEV_TYPE_POINTER;
    indev_drv.read_cb  = touch_read_cb;
    lv_indev_drv_register(&indev_drv);
    Serial.println("[HMI] LVGL display + touch registered");

    uart_init();

    ui_app_init();
    ui_main_screen_create();
    ui_settings_screen_create();

    lv_scr_load(ui_main_screen);
    Serial.println("[HMI] UI screens created, main screen loaded");

    last_tick_ms = millis();
    Serial.println("[HMI] Setup complete! Entering main loop...\n");
}

void loop()
{
    uint32_t now = millis();
    lv_tick_inc(now - last_tick_ms);
    last_tick_ms = now;

    lv_timer_handler();

    uart_process();

    if (app_state.data_updated) {
        ui_main_screen_refresh();
    }

    delay(2);
}
