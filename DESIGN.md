---
name: Water Gate Way
description: Field-engineering instrument panel for Thai irrigation water gates — calm, light, legible in sunlight.
colors:
  bg: "#f4f5f2"
  surface: "#ffffff"
  surface-2: "#eceee9"
  border: "#e1e4df"
  rule: "#eef0ec"
  control: "#c9cec6"
  fg: "#142029"
  muted: "#55606a"
  accent: "#3860b0"
  brand: "#202068"
  brand-2: "#3860b0"
  sky: "#38a8e0"
  on: "#136b35"
  on-soft: "#e3f3e8"
  off: "#3f4b57"
  off-soft: "#e6e9ec"
  warn: "#a35207"
  warn-soft: "#fdf0dc"
  danger: "#b4231b"
  danger-soft: "#fbe7e5"
  unknown: "#7b858e"
  tint-cream: "#fff6dd"
  tint-peach: "#fdeee3"
  tint-blue: "#e8f0fb"
  tint-sky: "#e3f4fc"
  video-black: "#000000"
typography:
  display:
    fontFamily: "LINE Seed Sans TH, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
  title:
    fontFamily: "LINE Seed Sans TH, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
  heading:
    fontFamily: "LINE Seed Sans TH, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  body:
    fontFamily: "LINE Seed Sans TH, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
  label:
    fontFamily: "LINE Seed Sans TH, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
  small:
    fontFamily: "LINE Seed Sans TH, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
rounded:
  control: "6px"
  panel: "8px"
  tile: "16px"
---

# Design System: Water Gate Way

## Overview

Mode: **Operate**. World: a field engineering instrument panel — calm, light, legible in sunlight, trustworthy like a well-made government utility tool. Not a sci-fi console, not a SaaS template.

**Key characteristics:**
- Flat panels with 1px edges; nothing floats except the map popup and the modal.
- Colour is rationed: chrome carries ink and navy only; state colours are the loudest thing on screen.
- Every number is tabular; every state is a word plus a dot, never colour alone.
- Motion is a crisp utility: short fades and colour transitions, one entrance per arrival, nothing over 260 ms.

**Motion contract:** tokens live in `src/app/globals.css` — `--dur-fast` 120 ms, `--dur-base` 180 ms, `--dur-slow` 260 ms, `--ease-out cubic-bezier(0.23, 1, 0.32, 1)`, `--ease-in-out cubic-bezier(0.77, 0, 0.175, 1)`. Route changes crossfade through React's `<ViewTransition>` in `layout.tsx` (opacity, ≈250 ms, browser-interpolated — shared chrome never remounts for motion). Other entrances are rare-tier one-shots (the post-login stagger, overlay fades 120–180 ms). Rapidly retriggered feedback uses transitions, never keyframes. `prefers-reduced-motion` demotes transform entrances to a short opacity fade and keeps spinners spinning.

## Colors

A light-only palette in three families: neutral paper-and-ink chrome, brand navy reserved for the chrome bar and control panel header, and state colours reserved for device truth.

### Neutral
- **bg** (#f4f5f2): page.
- **surface** (#ffffff): panels. **surface-2** (#eceee9): toolbars, table header, inactive segment.
- **border** (#e1e4df): 1px panel edges. **rule** (#eef0ec): row dividers inside panels.
- **control** (#c9cec6): input and outlined-button borders.
- **fg** (#142029): text. **muted** (#55606a): secondary text (≥4.5:1 on white).
- **video-black** (#000000): camera tile surface and video overlays only (spinner scrim `black/60`, error scrim `black/80`, white text on video).

### Accent
- **accent / brand-2** (#3860b0): water data only (gauge fill, chart line), the focus ring, and the one primary action per screen (the default Button variant) — never chrome.
- **brand** (#202068): the dashboard header and control-panel header bar. **sky** (#38a8e0): water illustration accents.

### State
- **on** (#136b35 / on-soft #e3f3e8): device running (darkened from #157f3c for 4.5:1 on on-soft).
- **off** (#3f4b57 / off-soft #e6e9ec): device stopped.
- **warn** (#a35207 / warn-soft #fdf0dc): warnings, light.
- **danger** (#b4231b / danger-soft #fbe7e5): alarm, errors, destructive.
- **unknown** (#7b858e): stale / no data (dashed outline pill + hollow dot + text).
- **tint-cream / tint-peach / tint-blue / tint-sky**: soft tile backgrounds behind single readings.

### Named Rules
**The Colour-Never-Alone Rule.** Every state is a word plus a dot plus an icon; colour may never carry the meaning by itself.
**The Accent-Rationing Rule.** Accent is water data and the focus ring — chrome never wears it.

## Typography

**Font:** LINE Seed Sans TH (self-hosted, `src/app/fonts/LINESeedSansTH_Rg.otf` 400, `LINESeedSansTH_Bd.otf` 700) via `next/font/local`, CSS var `--font-line-seed`, wired as `--font-sans`.

**Character:** one Thai-first family for the whole product; hierarchy comes from weight (400/700) and a fixed rem scale, not from a second family.

### Hierarchy
- **Display** (700, 28px): the gate name on a dashboard.
- **Title** (700, 22px): page-level headings.
- **Heading** (700, 18px): panel titles, h2/h3.
- **Body** (400, 16px): readings, copy.
- **Label** (700, 14px): labels, table headers, buttons.
- **Small** (700, 12px): pills and chips.

Scale ratio ~1.2: 12 / 14 / 16 / 18 / 22 / 28.

### Named Rules
**The Tabular Rule.** Every number renders `font-variant-numeric: tabular-nums`. No monospace font anywhere.

## Layout

- App bar 48px (`AppHeader`, one component everywhere): staff-gauge mark + "Water Gate Way" (mark only on a phone), nav as a neutral grey pill for the current section (แผนที่, ผู้ดูแลระบบ for admin), ออกจากระบบ. The product name is not an h1; each page has one h1.
- Primary button is near-black ink (`btn-primary`), one per screen. Chrome carries no brand colour.
- Dashboard: header row (gate name h1, link state, the device's own `receivedAt`), then cameras (3 across from 640px), three instrument tiles across from md — electric (tinted dl), float switches, wire-break loops — then the water level panel (staff gauge + 24-row history chart + CSV) with the person-detection tile beneath it, and the 420px sticky control rail beside them from lg. Phone (single column = DOM order): header → receivedAt → cameras → instrument tiles → water level + detection → controls.
- Water thresholds (warn 3 m, danger 5 m, scale 8 m) live in `src/app/dashboard/_components/levels.ts`; gauge and chart both read them.
- Readings keep each type's own grammar instead of a shared card template: electric uses tinted rows, floats and wire-break loops use plain definition-list rows. The loading skeleton (`dashboard/loading.tsx`) mirrors this exact shape so the streamed swap never jumps.

## Elevation & Depth

The system is flat. Depth is a 1px border; panels do not lift. Exactly two surfaces may carry a shadow because they truly float.

### Shadow Vocabulary
- **Map popup** (`box-shadow: 0 4px 16px rgb(20 32 41 / 0.08)`): the one resting shadow, in `globals.css` under `.leaflet-popup-content-wrapper`.
- **Modal** (Tailwind `shadow-xl`): the `<dialog>` in the top layer.

### Named Rules
**The Flat-Panel Rule.** Cards and panels never carry a shadow — the 1px border is the whole edge. If a surface does not float above the page, it gets no shadow.

## Shapes

Two radius tiers, by role: **16px (`rounded-2xl`)** for dashboard feature tiles, camera tiles and the modal; **8px (`rounded-lg`)** for compact panels (admin sections, auth cards); **6px (`rounded-md`)** for controls (buttons, inputs, pills use full rounding as chips). Edges are 1px `border-border`; inner dividers are 1px `border-rule`.

## Components

### Device control (signature)
One row per device: icon + Thai name, a large state readout, and a two-segment switch `[ ปิด | เปิด ]`. The segment matching the current state is filled (on → green, off → slate) with `aria-pressed="true"` and a check icon; the other segment is outlined and is the action. Unknown state: neither segment filled. Both segments ≥ 48px tall. A fixed-height status line under the row reports the command lifecycle (SENDING "กำลังส่งคำสั่ง…", WAITING "ส่งแล้ว รออุปกรณ์ยืนยัน", FAILED: error text + retry) so nothing jumps.

### State pill
Dot + word (`pill` utility): soft background, bold 12px word, 8px dot in the state colour. UNKNOWN: dashed outline, hollow dot, muted word — never a fill.

### Buttons
- **Primary:** near-black ink (`btn-primary`, fg background, white text), one per screen.
- **Secondary:** white surface + `control` border.
- **Danger:** white surface + `danger` border + `danger` text.
- Press feedback is a 1px drop (`active:translate-y-px`), instant by design.

### Inputs
`input-field`: white surface, 1px `control` border, 6px radius, min-height 44px. Focus: the global 2px accent ring with 2px offset.

## Do's and Don'ts

### Do:
- **Do** keep every state as word + dot + icon; colour never works alone.
- **Do** keep a stale reading visually muted AND worded (UNKNOWN pill, muted readings) — stale must never look live.
- **Do** use the motion tokens (`--dur-fast`/`--dur-base`/`--dur-slow`, `--ease-out`) for every transition; entrances are rare-tier one-shots only (route change, login, overlay appears).
- **Do** reserve shadows for the map popup and the modal.

### Don't:
- **Don't** put a shadow on a card, panel or tile (`The Flat-Panel Rule`).
- **Don't** animate per-telemetry-tick updates — colour transitions only, never keyframes.
- **Don't** wear accent on chrome — brand navy and ink are the only chrome colours.
- **Don't** let any motion run longer than 260 ms, and always honour `prefers-reduced-motion` (transform entrances fall back to a short fade; spinners keep spinning).
