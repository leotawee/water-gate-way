/**
 * @file tft_setup.h
 * TFT_eSPI Configuration for ESP32-S3 HMI Water Gate Controller
 *
 * Display: 480x320 Landscape TFT (ILI9488/ST7796)
 * Touch: XPT2046 SPI Resistive
 */

// Driver Selection
#define ST7796_DRIVER

// Display Configuration
#define TFT_WIDTH  480
#define TFT_HEIGHT 320

// SPI TFT Pin Map (ESP32-S3 GPIO)
#define TFT_MOSI  7
#define TFT_SCLK  6
#define TFT_CS    5
#define TFT_DC    4
#define TFT_RST   8
#define TFT_BL    10

// Touch Pin Map (XPT2046, shares SPI with TFT)
#define TOUCH_CS  3

// SPI Frequency
#define SPI_FREQUENCY  27000000
#define SPI_READ_FREQUENCY  20000000

// Touch Settings
#define TOUCH_CS_FREQUENCY  2500000

// Display Options
#define LOAD_GLCD   // Font 1. Original Adafruit 8 pixel font needs ~1820 bytes in FLASH
#define LOAD_FONT2  // Font 2. Small 16 pixel high font, needs ~3534 bytes in FLASH
#define LOAD_FONT4  // Font 4. Medium 26 pixel high font, needs ~5836 bytes in FLASH
#define LOAD_FONT6  // Font 6. Large 48 pixel font, needs ~2666 bytes in FLASH
#define LOAD_FONT7  // Font 7. 7 segment 48 pixel font, needs ~2438 bytes in FLASH
#define LOAD_FONT8  // Font 8. Large 75 pixel font needs ~3256 bytes in FLASH
#define LOAD_GFXFF  // FreeFonts. Include support for free fonts
#define SMOOTH_FONT

// SPI Transaction Settings
#define SPI_TOUCH_FREQUENCY  2500000
