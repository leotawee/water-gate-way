/**
 * ============================================================
 *  UI_SETTINGS_SCREEN.CPP — Settings Screen + Sub-pages
 * ============================================================
 *  Sub-pages (shown/hidden within one LVGL screen):
 *    1. Settings Menu    — two large option buttons
 *    2. Sensor Setup     — stepper controls for calibration
 *    3. Threshold Setup  — stepper controls + mini bar visual
 *
 *  ┌────────────────────────────────────────────────────┐
 *  │ Header: [SETTINGS]                        [X]     │
 *  ├─────────────────────┬──────────────────────────────┤
 *  │                     │                              │
 *  │   Sensor Setup      │   Threshold Setup            │
 *  │   ตั้งค่าระยะเซนเซอร์  │   ตั้งค่าระดับน้ำ 3 ระดับ       │
 *  │                     │                              │
 *  ├─────────────────────┴──────────────────────────────┤
 *  │ [Main]              [Settings]                     │
 *  └────────────────────────────────────────────────────┘
 * ============================================================
 */

#include "ui_settings_screen.h"
#include "ui_main_screen.h"
#include "ui_app.h"

/* ═══════════════════════════════════════════════════════════
 *  Forward declarations (event handlers)
 * ═══════════════════════════════════════════════════════════ */
static void evt_close(lv_event_t *e);
static void evt_back_to_menu(lv_event_t *e);
static void evt_sensor_setup(lv_event_t *e);
static void evt_threshold_setup(lv_event_t *e);
static void evt_save_sensor(lv_event_t *e);
static void evt_save_threshold(lv_event_t *e);
static void evt_cancel(lv_event_t *e);
static void evt_nav_main(lv_event_t *e);
static void evt_step_minus(lv_event_t *e);
static void evt_step_plus(lv_event_t *e);

/* ═══════════════════════════════════════════════════════════
 *  Sub-page containers (show/hide)
 * ═══════════════════════════════════════════════════════════ */
static lv_obj_t *page_menu      = nullptr;
static lv_obj_t *page_sensor    = nullptr;
static lv_obj_t *page_threshold = nullptr;

/* ═══════════════════════════════════════════════════════════
 *  Stepper data — links a button pair to a float variable
 * ═══════════════════════════════════════════════════════════ */
typedef struct {
    float  *value;         /* pointer to the live float value     */
    float   step;          /* increment / decrement amount        */
    float   min_val;       /* lower bound                         */
    float   max_val;       /* upper bound                         */
    lv_obj_t *label;       /* label widget showing the value      */
} stepper_ctx_t;

/* One context per stepper row */
static stepper_ctx_t ctx_water_level;
static stepper_ctx_t ctx_distance;
static stepper_ctx_t ctx_height;       /* Sensor Height (readonly, calculated) */
static stepper_ctx_t ctx_thr_lv1;
static stepper_ctx_t ctx_thr_lv2;
static stepper_ctx_t ctx_thr_lv3;

/* Static storage for stepper values (each pointer targets one of these) */
static float s_water = 1.25f;
static float s_dist  = 1.25f;
static float s_lv1   = 0.80f;
static float s_lv2   = 1.50f;
static float s_lv3   = 1.80f;

/* ═══════════════════════════════════════════════════════════
 *  Helpers
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

/** Show one sub-page, hide the other two */
static void show_page(lv_obj_t *target)
{
    lv_obj_clear_flag(target, LV_OBJ_FLAG_HIDDEN);
    if (target != page_menu)      lv_obj_add_flag(page_menu,      LV_OBJ_FLAG_HIDDEN);
    if (target != page_sensor)    lv_obj_add_flag(page_sensor,    LV_OBJ_FLAG_HIDDEN);
    if (target != page_threshold) lv_obj_add_flag(page_threshold, LV_OBJ_FLAG_HIDDEN);
}

/** Build a header bar: title on left, close/back button on right */
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
    lv_obj_set_style_border_bottom(hdr, 1, 0);
    lv_obj_set_style_border_color(hdr, CLR_BORDER, 0);
    lv_obj_set_style_border_side(hdr, LV_BORDER_SIDE_BOTTOM, 0);
    lv_obj_set_style_pad_column(hdr, 6, 0);
    lv_obj_clear_flag(hdr, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *lbl = lv_label_create(hdr);
    lv_label_set_text(lbl, title);
    lv_obj_set_style_text_color(lbl, CLR_ACCENT, 0);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_14, 0);

    /* spacer */
    lv_obj_t *sp = lv_obj_create(hdr);
    lv_obj_remove_style_all(sp);
    lv_obj_set_flex_grow(sp, 1);
    lv_obj_set_size(sp, 0, 0);
    lv_obj_clear_flag(sp, LV_OBJ_FLAG_SCROLLABLE);

    /* button */
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

/** Build bottom navigation bar */
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

    /* Main button */
    lv_obj_t *b1 = lv_btn_create(nav);
    lv_obj_set_flex_grow(b1, 1);
    lv_obj_set_style_min_height(b1, 36, 0);
    lv_obj_set_style_bg_color(b1, settings_active ? CLR_BORDER : CLR_ACCENT, 0);
    lv_obj_set_style_bg_opa(b1, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(b1, 8, 0);
    lv_obj_set_style_shadow_width(b1, 0, 0);
    lv_obj_set_style_border_color(b1, CLR_ACCENT, 0);
    lv_obj_set_style_border_width(b1, 1, 0);
    lv_obj_add_event_cb(b1, evt_nav_main, LV_EVENT_CLICKED, NULL);

    lv_obj_t *t1 = lv_label_create(b1);
    lv_label_set_text(t1, LV_SYMBOL_IMAGE " Main");
    lv_obj_set_style_text_color(t1, settings_active ? CLR_ACCENT : CLR_BG_SCREEN, 0);
    lv_obj_set_style_text_font(t1, &lv_font_montserrat_14, 0);
    lv_obj_center(t1);

    /* Settings button */
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

/** Create a stepper row: [dot] [label] [−] [value] [+] [unit] */
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

    /* Color dot */
    lv_obj_t *dot = lv_obj_create(row);
    lv_obj_remove_style_all(dot);
    lv_obj_set_size(dot, 8, 8);
    lv_obj_set_style_bg_color(dot, dot_color, 0);
    lv_obj_set_style_bg_opa(dot, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(dot, LV_RADIUS_CIRCLE, 0);
    lv_obj_clear_flag(dot, LV_OBJ_FLAG_SCROLLABLE);

    /* Row label */
    lv_obj_t *lbl = lv_label_create(row);
    lv_label_set_text(lbl, row_label);
    lv_obj_set_style_text_color(lbl, CLR_TEXT_LABEL, 0);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_14, 0);
    lv_obj_set_style_min_width(lbl, 100, 0);

    /* Spacer */
    lv_obj_t *sp = lv_obj_create(row);
    lv_obj_remove_style_all(sp);
    lv_obj_set_flex_grow(sp, 1);
    lv_obj_set_size(sp, 0, 0);
    lv_obj_clear_flag(sp, LV_OBJ_FLAG_SCROLLABLE);

    /* Minus button */
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

    /* Value label */
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

    /* Value text (centered in the box) */
    lv_obj_t *vtxt = lv_label_create(val_lbl);
    char vbuf[16];
    snprintf(vbuf, sizeof(vbuf), "%.2f", init_val);
    lv_label_set_text(vtxt, vbuf);
    lv_obj_center(vtxt);

    /* Plus button */
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

    /* Unit label */
    lv_obj_t *unit = lv_label_create(row);
    lv_label_set_text(unit, "m");
    lv_obj_set_style_text_color(unit, CLR_TEXT_DIM, 0);
    lv_obj_set_style_text_font(unit, &lv_font_montserrat_14, 0);

    /* Fill the stepper context — link to the file-scope static */
    float *storage = nullptr;
    if      (ctx == &ctx_water_level) { s_water = init_val; storage = &s_water; }
    else if (ctx == &ctx_distance)    { s_dist  = init_val; storage = &s_dist;  }
    else if (ctx == &ctx_height)      { /* readonly, value set externally */ storage = &s_water; }
    else if (ctx == &ctx_thr_lv1)     { s_lv1   = init_val; storage = &s_lv1;   }
    else if (ctx == &ctx_thr_lv2)     { s_lv2   = init_val; storage = &s_lv2;   }
    else                              { s_lv3   = init_val; storage = &s_lv3;   }

    ctx->value   = storage;
    ctx->step    = step;
    ctx->min_val = min_v;
    ctx->max_val = max_v;
    ctx->label   = vtxt;
}

/* ═══════════════════════════════════════════════════════════
 *  ui_settings_screen_create
 * ═══════════════════════════════════════════════════════════ */
void ui_settings_screen_create(void)
{
    /* ── Screen root ─────────────────────────────────────── */
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

    /* ══════════════════════════════════════════════════════════
     *  PAGE 1: Settings Menu (landing page)
     * ══════════════════════════════════════════════════════════ */
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

    /* Two large menu buttons side-by-side */
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

    /* ── Sensor Setup menu button ── */
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

    /* Top accent line (cyan) — using a border-top trick */
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
    lv_label_set_text(mi1, LV_SYMBOL_WIFI);   /* antenna icon */
    lv_obj_set_style_text_font(mi1, &lv_font_montserrat_28, 0);
    lv_obj_set_style_text_color(mi1, CLR_ACCENT, 0);

    lv_obj_t *mt1 = lv_label_create(mb1c);
    lv_label_set_text(mt1, "Sensor Setup");
    lv_obj_set_style_text_font(mt1, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(mt1, CLR_TEXT_WHITE, 0);

    lv_obj_t *md1 = lv_label_create(mb1c);
    lv_label_set_text(md1, "Set sensor range");  /* Thai: ตั้งค่าระยะเซนเซอร์ */
    lv_obj_set_style_text_font(md1, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(md1, CLR_TEXT_LABEL, 0);

    /* ── Threshold Setup menu button ── */
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
    lv_label_set_text(mi2, LV_SYMBOL_IMAGE);   /* chart icon */
    lv_obj_set_style_text_font(mi2, &lv_font_montserrat_28, 0);
    lv_obj_set_style_text_color(mi2, CLR_ORANGE, 0);

    lv_obj_t *mt2 = lv_label_create(mb2c);
    lv_label_set_text(mt2, "Threshold Setup");
    lv_obj_set_style_text_font(mt2, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(mt2, CLR_TEXT_WHITE, 0);

    lv_obj_t *md2 = lv_label_create(mb2c);
    lv_label_set_text(md2, "Set 3 water levels");  /* Thai: ตั้งค่าระดับน้ำ 3 ระดับ */
    lv_obj_set_style_text_font(md2, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(md2, CLR_TEXT_LABEL, 0);

    make_nav(page_menu, true);   /* Settings nav active */

    /* ══════════════════════════════════════════════════════════
     *  PAGE 2: Sensor Setup
     * ══════════════════════════════════════════════════════════ */
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
                     &ctx_height,          /* readonly — calculated from water + distance */
                     app_state.sensor_height, 0.01f, 0.0f, 9.99f, true);

    /* Save / Cancel buttons */
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

    /* ══════════════════════════════════════════════════════════
     *  PAGE 3: Threshold Setup
     * ══════════════════════════════════════════════════════════ */
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

    /* Body: mini bar on left + form on right */
    lv_obj_t *tbody = lv_obj_create(page_threshold);
    lv_obj_remove_style_all(tbody);
    lv_obj_set_size(tbody, lv_pct(100), LV_SIZE_CONTENT);
    lv_obj_set_flex_grow(tbody, 1);
    lv_obj_set_layout(tbody, LV_LAYOUT_FLEX);
    lv_obj_set_flex_flow(tbody, LV_FLEX_FLOW_ROW);
    lv_obj_set_style_pad_column(tbody, 12, 0);
    lv_obj_clear_flag(tbody, LV_OBJ_FLAG_SCROLLABLE);

    /* Mini visual bar */
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

    /* Mini fill bar */
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

    /* Mini threshold lines (static helper to avoid lambda) */
    static const int MINI_BAR_H = 160;
    auto add_mini_line = [&](int pct, lv_color_t c) {
        lv_obj_t *l = lv_obj_create(mini_bar_bg);
        lv_obj_remove_style_all(l);
        lv_obj_set_size(l, 40, 2);
        lv_obj_set_style_bg_color(l, c, 0);
        lv_obj_set_style_bg_opa(l, LV_OPA_COVER, 0);
        lv_obj_set_pos(l, 0, MINI_BAR_H - (MINI_BAR_H * pct / 100));
        lv_obj_clear_flag(l, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
    };
    add_mini_line(40, CLR_GREEN);    /* Lv1 */
    add_mini_line(60, CLR_ORANGE);   /* Lv2 */
    add_mini_line(80, CLR_RED);      /* Lv3 */

    /* Threshold stepper form */
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

    /* Save / Cancel */
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

/* ═══════════════════════════════════════════════════════════
 *  Public: show settings menu page
 * ═══════════════════════════════════════════════════════════ */
void ui_settings_show_menu(void)
{
    show_page(page_menu);
}

/* ═══════════════════════════════════════════════════════════
 *  EVENT HANDLERS
 * ═══════════════════════════════════════════════════════════ */

/* X close button → back to main screen */
static void evt_close(lv_event_t *e)
{
    (void)e;
    lv_scr_load_anim(ui_main_screen, LV_SCR_LOAD_ANIM_FADE_ON,
                     300, 0, false);
}

/* Back arrow → show settings menu */
static void evt_back_to_menu(lv_event_t *e)
{
    (void)e;
    show_page(page_menu);
}

/* "Sensor Setup" menu button */
static void evt_sensor_setup(lv_event_t *e)
{
    (void)e;
    show_page(page_sensor);
}

/* "Threshold Setup" menu button */
static void evt_threshold_setup(lv_event_t *e)
{
    (void)e;
    show_page(page_threshold);
}

/* Cancel → back to settings menu */
static void evt_cancel(lv_event_t *e)
{
    (void)e;
    show_page(page_menu);
}

/* Save sensor config → send to STM32, return to menu */
static void evt_save_sensor(lv_event_t *e)
{
    (void)e;
    /* Read current stepper values back into app_state */
    if (ctx_water_level.value)
        app_state.water_level = *ctx_water_level.value;
    if (ctx_distance.value)
        app_state.distance = *ctx_distance.value;
    /* Auto-calculate sensor height */
    app_state.sensor_height = app_state.water_level + app_state.distance;

    /* Send config to STM32 via UART */
    uart_send_sensor_config(app_state.water_level,
                            app_state.distance,
                            app_state.sensor_height);

    show_page(page_menu);
}

/* Save threshold config → send to STM32, return to menu */
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

/* Nav: Main → switch to main screen */
static void evt_nav_main(lv_event_t *e)
{
    (void)e;
    lv_scr_load_anim(ui_main_screen, LV_SCR_LOAD_ANIM_FADE_ON,
                     300, 0, false);
}

/* ── Stepper − button ── */
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

/* ── Stepper + button ── */
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
