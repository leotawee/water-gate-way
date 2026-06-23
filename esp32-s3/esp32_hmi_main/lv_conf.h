/**
 * @file lv_conf.h
 * Configuration file for LVGL (Light and Versatile Graphics Library)
 */

/* Copy this file as `lv_conf.h` and configure LVGL for your project */

/* This header should be included first to enable all LVGL configuration options */
#if 1 /* Set it to "1" to enable content */

#ifndef LV_CONF_H
#define LV_CONF_H

#include <stdint.h>

/* ====================   COLOR SETTINGS   ==================== */

/* Color depth:
 * - 1: 1 byte per pixel (requires `LV_COLOR_16_SWAP` in 8-bit mode)
 * - 8: RGB332 in 1 byte
 * - 16: RGB565 in 2 bytes (compatible with TFT_eSPI)
 * - 32: ARGB8888 in 4 bytes */
#define LV_COLOR_DEPTH 16

/* ====================   MEMORY SETTINGS   ==================== */

/* Size of the memory available for `lv_malloc()` in bytes (>= 2kB) */
#define LV_MEM_SIZE (32U * 1024U)  /* 32 kB */

/* Set an address for the memory pool instead of allocating it as a normal array */
#define LV_MEM_ADR 0

/* Use the standard `memcpy` and `memset` instead of LVGL's own functions */
#define LV_MEMCPY_MEMSET_STD 1

/* ====================   HAL SETTINGS   ==================== */

/* Default display refresh period in milliseconds */
#define LV_DEF_REFR_PERIOD 30

/* Input device read period in milliseconds */
#define LV_INDEV_DEF_READ_PERIOD 30

/* ====================   FONT USAGE   ==================== */

/* Montserrat fonts with various sizes and character sets */
#define LV_FONT_MONTSERRAT_8  0
#define LV_FONT_MONTSERRAT_10 0
#define LV_FONT_MONTSERRAT_12 1
#define LV_FONT_MONTSERRAT_14 1
#define LV_FONT_MONTSERRAT_16 1
#define LV_FONT_MONTSERRAT_18 0
#define LV_FONT_MONTSERRAT_20 1
#define LV_FONT_MONTSERRAT_22 1
#define LV_FONT_MONTSERRAT_24 0
#define LV_FONT_MONTSERRAT_26 0
#define LV_FONT_MONTSERRAT_28 1
#define LV_FONT_MONTSERRAT_30 0
#define LV_FONT_MONTSERRAT_32 0
#define LV_FONT_MONTSERRAT_34 0
#define LV_FONT_MONTSERRAT_36 0
#define LV_FONT_MONTSERRAT_38 0
#define LV_FONT_MONTSERRAT_40 0
#define LV_FONT_MONTSERRAT_42 0
#define LV_FONT_MONTSERRAT_44 0
#define LV_FONT_MONTSERRAT_46 0
#define LV_FONT_MONTSERRAT_48 0

/* Default font */
#define LV_FONT_DEFAULT &lv_font_montserrat_14

/* ====================   THEME SETTINGS   ==================== */

/* Default theme: */
#define LV_THEME_DEFAULT_DARK 1

/* ====================   WIDGET USAGE   ==================== */

/* Flexbox layout */
#define LV_USE_FLEX 1

/* Grid layout */
#define LV_USE_GRID 0

/* ====================   LVGL SETTINGS   ==================== */

/* Buffers used for LVGL drawing */
#define LV_DISP_REFR_PERIOD 30
#define LV_DISP_DEF_REFR_PERIOD 30

/* Asserts enabled */
#define LV_USE_ASSERT_NULL          1
#define LV_USE_ASSERT_MALLOC        1
#define LV_USE_ASSERT_STYLE         0
#define LV_USE_ASSERT_MEM_INTEGRITY 0
#define LV_USE_ASSERT_OBJ           0

/* Print logs */
#define LV_USE_LOG 1
#if LV_USE_LOG
    #define LV_LOG_LEVEL LV_LOG_LEVEL_WARN
    #define LV_LOG_PRINTF 1
#endif

/* ====================   INPUT DEVICE SETTINGS   ==================== */

/* Pointer input device (touchpad, mouse, etc) */
#define LV_USE_INDEV 1

/* ====================   OTHER SETTINGS   ==================== */

/* Default animation duration */
#define LV_DEF_ANIM_TIME 200

/* Object manager - manages object lifecycle */
#define LV_USE_OBJ_ID 0

/* Alternative allocator */
#define LV_USE_GC 0

/* Enable GPU support */
#define LV_USE_GPU_STM32_DMA2D 0
#define LV_USE_GPU_SWM341_DMA2D 0
#define LV_USE_GPU_NXP_PXP 0
#define LV_USE_GPU_NXP_VG_LITE 0
#define LV_USE_GPU_SDL 0

/* ==================== END OF FILE ==================== */

#endif /* LV_CONF_H */

#endif /* End of "Content enable" */
