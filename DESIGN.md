# Design: Water Gate Way

Mode: **Operate**. World: a field engineering instrument panel — calm, light, legible in sunlight, trustworthy like a well-made government utility tool. Not a sci-fi console, not a SaaS template.

## Type
- One family: **LINE Seed Sans TH** (self-hosted, `src/app/fonts/LINESeedSansTH_Rg.otf` 400, `LINESeedSansTH_Bd.otf` 700) via `next/font/local`, CSS var `--font-line-seed`, wired as `--font-sans`.
- Fixed rem scale, ratio ~1.2: 12 / 14 / 16 (body) / 18 / 22 / 28.
- Every number: `font-variant-numeric: tabular-nums`. No monospace font.

## Color (light only)
| token | hex | use |
|---|---|---|
| bg | #f4f5f2 | page |
| surface | #ffffff | panels |
| surface-2 | #eceee9 | toolbars, table header, inactive segment |
| border | #d3d8d0 | 1px dividers |
| fg | #142029 | text |
| muted | #55606a | secondary text (≥4.5:1 on white) |
| accent | #0a58a3 | primary actions, links, current nav, focus ring |
| on | #157f3c / on-soft #e3f3e8 | device running |
| off | #3f4b57 / off-soft #e6e9ec | device stopped |
| warn | #a35207 / warn-soft #fdf0dc | warnings, light |
| danger | #b4231b / danger-soft #fbe7e5 | alarm, errors, destructive |
| unknown | #7b858e | stale / no data (always with diagonal hatch + text) |

Color never carries meaning alone: every state has a word and an icon.

## Device state vocabulary (Thai)
- ON: "ทำงาน" — filled green dot + green-soft background.
- OFF: "ปิดอยู่" — filled slate dot + off-soft background.
- UNKNOWN: "ไม่ทราบสถานะ" — hollow dashed dot + hatched background.
- SENDING: "กำลังส่งคำสั่ง…"; WAITING: "ส่งแล้ว รออุปกรณ์ยืนยัน"; FAILED: error text + retry.

## Device control pattern
One row per device: icon + Thai name, a large state readout, and a two-segment switch `[ ปิด | เปิด ]`. The segment matching the current state is filled (on → green, off → slate) with `aria-pressed="true"` and a check icon; the other segment is outlined and is the action. Unknown state: neither segment filled. Both segments ≥ 48px tall.

## Layout
- App bar 56px: Waves mark + "Water Gate Way", nav (แผนที่, ผู้ดูแลระบบ for admin), ออกจากระบบ.
- Dashboard desktop ≥1024: status strip, then 2 columns — main (cameras, water chart, readings) and a 400px sticky right column "ควบคุมอุปกรณ์". Mobile: status → controls → cameras → readings → chart.
- Readings are grouped definition lists inside one panel, not a grid of same-size cards.

## Shape and depth
Radius 8px (controls 6px). Depth by 1px borders; one soft shadow `0 1px 2px rgb(20 32 41 / .06), 0 4px 12px rgb(20 32 41 / .05)` for the sticky control column only.

## Motion
150–200ms color/background transitions only. Respect prefers-reduced-motion.
