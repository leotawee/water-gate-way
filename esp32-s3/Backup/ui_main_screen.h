/**
 * ============================================================
 *  UI_MAIN_SCREEN.H — Main Dashboard Screen API
 *  Layout: Header | Water Bar | Pump Status | Info | Nav
 * ============================================================
 */
#pragma once

#include <lvgl.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Create the main dashboard screen and all its child widgets.
 * Stores handle in the global `ui_main_screen`.
 * Call once during setup.
 */
void ui_main_screen_create(void);

/**
 * Push the current app_state into all main-screen widgets.
 * Called from the main loop when app_state.data_updated == true.
 */
void ui_main_screen_refresh(void);

#ifdef __cplusplus
}
#endif
