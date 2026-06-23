/**
 * ============================================================
 *  UI_MAIN_SCREEN.CPP — Main Dashboard Screen
 * ============================================================
 *  Landscape 480×320 — layout from ui-mockup (1).html
 *
 *  ┌────────────────────────────────────────────────────┐
 *  │ Header: [WATER GATE 1] [AUTO] [S]                 │
 *  ├──────────┬──────────┬──────────────────────────────┤
 *  │          │ PUMP 1   │  Current                      │
 *  │  Water   │  RUN     │  1.25                         │
 *  │  Level   │──────────│  meters                       │
 *  │  Bar     │ PUMP 2   │──────────────────────────────│
 *  │  [62%]   │  STOP    │  Sensor                       │
 *  │          │          │  2.50  m height               │
 *  ├──────────┴──────────┴──────────────────────────────┤
 *  │ [Main]              [Settings]                      │
 *  └────────────────────────────────────────────────────┘
 * ============================================================
 */

#include "ui_main_screen.h"
#include "ui_settings_screen.h"
#include "ui_app.h"

/* ═══════════════════════════════════════════════════════════
 *  Forward declarations
 * ═══════════════════════════════════════════════════════════ */
static void evt_settings_btn(lv_event_t *e);
static void evt_nav_main(lv_event_t *e);
static void evt_nav_settings(lv_event_t *e);

/* ═══════════════════════════════════════════════════════════
 *  Persistent widget handles (needed for runtime refresh)
 * ═══════════════════════════════════════════════════════════ */
static lv_obj_t *bar_water   = nullptr;
static lv_obj_t *lbl_current = nullptr;
static lv_obj_t *lbl_sensor  = nullptr;
static lv_obj_t *lbl_pump1   = nullptr;
static lv_obj_t *lbl_pump2   = nullptr;
static lv_obj_t *lbl_mode    = nullptr;

/* ═══════════════════════════════════════════════════════════
 *  Layout constants
 * ═══════════════════════════════════════════════════════════ */
#define BAR_WRAPPER_W       54
#define BAR_WRAPPER_H       190     /* fixed height for reliable threshold placement */
#define PUMP_COL_W          90
#define INFO_COL_W          130

/* ═══════════════════════════════════════════════════════════
 *  Helper — create a styled panel container
 * ═══════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════
 *  Helper — add a threshold marker line + label inside bar
 *
 *  bar_wrapper : parent container (the dark bar track)
 *  tag         : e.g. "Lv1"
 *  value_text  : e.g. "0.80m"
 *  pct_from_bottom : 0..100 — position from bottom of bar
 *  color       : line & label color
 * ═══════════════════════════════════════════════════════════ */
static void add_threshold_mark(lv_obj_t *bar_wrapper,
                                const char *tag,
                                const char *value_text,
                                uint8_t pct_from_bottom,
                                lv_color_t color)
{
    /* Horizontal line */
    lv_obj_t *line = lv_obj_create(bar_wrapper);
    lv_obj_remove_style_all(line);
    lv_obj_set_size(line, BAR_WRAPPER_W - 4, 1);
    lv_obj_set_style_bg_color(line, color, 0);
    lv_obj_set_style_bg_opa(line, LV_OPA_COVER, 0);
    lv_obj_set_pos(line, 2,
                   BAR_WRAPPER_H - (BAR_WRAPPER_H * pct_from_bottom / 100));
    lv_obj_clear_flag(line, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);

    /* Label (tag + value, positioned to the right of the line) */
    lv_obj_t *lbl = lv_label_create(bar_wrapper);
    lv_label_set_text_fmt(lbl, "%s %s", tag, value_text);
    lv_obj_set_style_text_color(lbl, color, 0);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_12, 0);
    lv_obj_align_to(lbl, line, LV_ALIGN_OUT_RIGHT_MID, 4, 0);
    lv_obj_clear_flag(lbl, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
}

/* ═══════════════════════════════════════════════════════════
 *  ui_main_screen_create
 * ═══════════════════════════════════════════════════════════ */
void ui_main_screen_create(void)
{
    /* ── Screen root ─────────────────────────────────────── */
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

    /* ══════════════════════════════════════════════════════════
     *  HEADER  — title | mode badge | settings btn
     * ══════════════════════════════════════════════════════════ */
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
    lv_obj_set_style_border_bottom(header, 1, 0);
    lv_obj_set_style_border_color(header, CLR_BORDER, 0);
    lv_obj_set_style_border_side(header, LV_BORDER_SIDE_BOTTOM, 0);
    lv_obj_set_style_pad_column(header, 6, 0);
    lv_obj_clear_flag(header, LV_OBJ_FLAG_SCROLLABLE);

    /* Title: ⚡ WATER GATE 1 */
    lv_obj_t *lbl_title = lv_label_create(header);
    lv_label_set_text(lbl_title, LV_SYMBOL_CHARGE " WATER GATE 1");
    lv_obj_set_style_text_color(lbl_title, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(lbl_title, &lv_font_montserrat_14, 0);

    /* Spacer (flex-grow → push badge & gear to the right) */
    lv_obj_t *spacer = lv_obj_create(header);
    lv_obj_remove_style_all(spacer);
    lv_obj_set_flex_grow(spacer, 1);
    lv_obj_set_size(spacer, 0, 0);
    lv_obj_clear_flag(spacer, LV_OBJ_FLAG_SCROLLABLE);

    /* Mode badge — orange pill */
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

    /* Settings button (gear icon) */
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

    /* ══════════════════════════════════════════════════════════
     *  MAIN CONTENT — 3 columns  (flex-row)
     * ══════════════════════════════════════════════════════════ */
    lv_obj_t *content = lv_obj_create(ui_main_screen);
    lv_obj_remove_style_all(content);
    lv_obj_set_size(content, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_flex_grow(content, 1);
    lv_obj_set_layout(content, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(content, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(content,
                          LV_FLEX_ALIGN_START,
                          LV_FLEX_ALIGN_STRETCH,
                          LV_FLEX_ALIGN_STRETCH);
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

    /* Bar track — dark container holding the bar + threshold markers */
    lv_obj_t *bar_wrapper = lv_obj_create(col_bar);
    lv_obj_remove_style_all(bar_wrapper);
    lv_obj_set_size(bar_wrapper, BAR_WRAPPER_W + 70, BAR_WRAPPER_H);
    lv_obj_set_style_bg_color(bar_wrapper, CLR_BG_BAR_TRACK, 0);
    lv_obj_set_style_bg_opa(bar_wrapper, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(bar_wrapper, 6, 0);
    lv_obj_set_style_pad_all(bar_wrapper, 0, 0);
    lv_obj_clear_flag(bar_wrapper, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_clip_corner(bar_wrapper, true, 0);

    /* The actual LVGL bar widget — vertical (height > width) */
    bar_water = lv_bar_create(bar_wrapper);
    lv_obj_set_size(bar_water, BAR_WRAPPER_W, BAR_WRAPPER_H);
    lv_obj_align(bar_water, LV_ALIGN_LEFT_MID, 0, 0);
    lv_bar_set_range(bar_water, 0, 100);

    /* Bar indicator: gradient bottom(#0066CC) → top(#00BCD4) */
    lv_obj_set_style_bg_color(bar_water, CLR_BAR_START, LV_PART_INDICATOR);
    lv_obj_set_style_bg_grad_color(bar_water, CLR_ACCENT, LV_PART_INDICATOR);
    lv_obj_set_style_bg_grad_dir(bar_water, LV_GRAD_DIR_VER, LV_PART_INDICATOR);
    lv_obj_set_style_radius(bar_water, 4, LV_PART_INDICATOR);

    /* Bar track styling */
    lv_obj_set_style_bg_color(bar_water, CLR_BG_BAR_TRACK, LV_PART_MAIN);
    lv_obj_set_style_bg_opa(bar_water, LV_OPA_COVER, LV_PART_MAIN);
    lv_obj_set_style_radius(bar_water, 6, LV_PART_MAIN);

    /* Initial value */
    lv_bar_set_value(bar_water,
                     WATER_LEVEL_PCT(app_state.water_level), LV_ANIM_OFF);

    /* Threshold markers — positions match HTML mockup percentages */
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

    /* Pump 1 */
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
    lv_obj_set_style_letter_space(lbl_p1_tag, 1, 0);

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

    /* Pump 2 */
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
    lv_obj_set_style_letter_space(lbl_p2_tag, 1, 0);

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

    /* Current level box */
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

    /* Sensor height box */
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

    /* ══════════════════════════════════════════════════════════
     *  BOTTOM NAVIGATION
     * ══════════════════════════════════════════════════════════ */
    lv_obj_t *nav = lv_obj_create(ui_main_screen);
    lv_obj_remove_style_all(nav);
    lv_obj_set_size(nav, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_layout(nav, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(nav, LV_FLEX_FLOW_ROW);
    lv_obj_set_style_pad_column(nav, 8, 0);
    lv_obj_set_style_pad_top(nav, 4, 0);
    lv_obj_clear_flag(nav, LV_OBJ_FLAG_SCROLLABLE);

    /* "Main" button — active (filled cyan) */
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

    /* "Settings" button — inactive (border only) */
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

/* ═══════════════════════════════════════════════════════════
 *  ui_main_screen_refresh  —  push app_state → widgets
 * ═══════════════════════════════════════════════════════════ */
void ui_main_screen_refresh(void)
{
    char buf[16];

    /* Water bar */
    lv_bar_set_value(bar_water,
                     WATER_LEVEL_PCT(app_state.water_level), LV_ANIM_ON);

    /* Current level */
    snprintf(buf, sizeof(buf), "%.2f", app_state.water_level);
    lv_label_set_text(lbl_current, buf);

    /* Sensor height */
    snprintf(buf, sizeof(buf), "%.2f", app_state.sensor_height);
    lv_label_set_text(lbl_sensor, buf);

    /* Pump 1 */
    if (app_state.pump1 == PUMP_RUN) {
        lv_label_set_text(lbl_pump1, "RUN");
        lv_obj_set_style_text_color(lbl_pump1, CLR_GREEN, 0);
        lv_obj_set_style_bg_color(lbl_pump1, CLR_GREEN_BG, 0);
    } else {
        lv_label_set_text(lbl_pump1, "STOP");
        lv_obj_set_style_text_color(lbl_pump1, CLR_GRAY, 0);
        lv_obj_set_style_bg_color(lbl_pump1, CLR_GRAY_BG, 0);
    }

    /* Pump 2 */
    if (app_state.pump2 == PUMP_RUN) {
        lv_label_set_text(lbl_pump2, "RUN");
        lv_obj_set_style_text_color(lbl_pump2, CLR_GREEN, 0);
        lv_obj_set_style_bg_color(lbl_pump2, CLR_GREEN_BG, 0);
    } else {
        lv_label_set_text(lbl_pump2, "STOP");
        lv_obj_set_style_text_color(lbl_pump2, CLR_GRAY, 0);
        lv_obj_set_style_bg_color(lbl_pump2, CLR_GRAY_BG, 0);
    }

    /* Mode badge */
    if (app_state.mode == MODE_AUTO) {
        lv_label_set_text(lbl_mode, "AUTO");
        lv_obj_set_style_bg_color(lbl_mode, CLR_ORANGE, 0);
    } else {
        lv_label_set_text(lbl_mode, "MANUAL");
        lv_obj_set_style_bg_color(lbl_mode, CLR_ACCENT, 0);
    }

    app_state.data_updated = false;
}

/* ═══════════════════════════════════════════════════════════
 *  EVENT HANDLERS
 * ═══════════════════════════════════════════════════════════ */

static void evt_settings_btn(lv_event_t *e)
{
    (void)e;
    lv_scr_load_anim(ui_settings_screen, LV_SCR_LOAD_ANIM_FADE_ON,
                     300, 0, false);
}

static void evt_nav_main(lv_event_t *e)
{
    (void)e;
    /* Already on main — no action needed */
}

static void evt_nav_settings(lv_event_t *e)
{
    (void)e;
    lv_scr_load_anim(ui_settings_screen, LV_SCR_LOAD_ANIM_FADE_ON,
                     300, 0, false);
}
