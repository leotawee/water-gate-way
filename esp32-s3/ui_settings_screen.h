/**
 * ============================================================
 *  UI_SETTINGS_SCREEN.H — Settings Screen API
 *  Contains: Settings Menu, Sensor Setup, Threshold Setup
 * ============================================================
 */
#pragma once

#include <lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Create the settings screen and all sub-pages (menu, sensor, threshold).
 * Stores handle in the global `ui_settings_screen`.
 * Call once during setup.
 */
void ui_settings_screen_create(void);

/**
 * Show the settings menu (main landing page of settings).
 * Hides sensor / threshold sub-pages.
 */
void ui_settings_show_menu(void);

#ifdef __cplusplus
}
#endif
