# Dashboard polish: bigger cameras, equal bottom row, icons

## [17:10] Audit, then changes

- **Action:** ran the design detector (clean), then rendered the dashboard at 2400, 1440, 1100, 1024, 768 and 375 px (temporary preview page in a scratch copy, removed) and measured element boxes; changed `DashboardClient.tsx`, `loading.tsx`, `ControlPanel.tsx`, `WaterLevelChart.tsx`, the four reading cards, `AppHeader.tsx`, the admin shell, tabs and pages, the map page; new `CardTitle.tsx`.
- **Why:** the owner saw the water panel and the control panel end on different lines, wanted bigger cameras with the same three-across layout, and wanted icons on cards, the CSV link and other pages. The page was capped at 1376 px, so on a wide or zoomed-out window the cameras stayed about 430 px wide.
- **Result:** page cap 1680 px (cameras 528 px at 2400 px wide, 443 px at 1440 px); the bottom row grid now stretches, the water panel fills and the plot grows into the space, the control panel is `h-full`; measured tops and bottoms equal at 2400, 1440 and 1100 px. Two-column readings start at `lg`; at 768 px the floats and wire-break tiles sit side by side instead of leaving a blank under the electric tile. Icons (lucide, 1.75 stroke, muted, `aria-hidden`) on the cards, the CSV link (now an outlined `FileDown` button), the control panel header, the app header nav, admin tabs and titles, and the map list title. Login form not changed.
- **Lesson:** I shipped the previous layout after checking only 1440 and 375 px; the owner's wide window exposed the cap and the unequal heights. Measure boxes at the widths people really use (wide, zoomed out) and at every breakpoint, not just two.

## Summary

- Changed: files above. Unchanged: data, API, auth, login form.
- Remaining: seen-state (warn tint) of the AI tile not viewed with live data; admin pages not rendered (need the database); screen reader pass.
- 📌 GENERAL: for a layout change, scan the breakpoints in between the two you design for.

## [19:10] Float card row names set by the owner

- **Action:** `FloatSwitchCard.tsx` rows now read "RS485 RADAR (status)" (f1), "ALS-MPM RADAR (status)" (f2), "ลูกลอย" (f3); row layout wraps the state pill under a long label.
- **Why:** the owner asked for these names after I reported the conflict: `docs/diagram/1.drawio` draws Float1-3, the 46-byte status frame has only `float_state` bits 0-2, no radar status field and no ALS-MPM anywhere (Mac, Pi, repo history searched; STM32 firmware source not available).
- **Result:** typecheck, lint, 463 tests pass; rendered at 1440, 1024 and 375 px: no overflow (at 1024 px the pill drops under the two long labels). A WHY comment in the file records the diagram mismatch.
- **Lesson:** when the owner overrides a documented mapping, do it, but leave the evidence next to the code so the next reader can check it against the firmware.

- **Correction [19:25]:** the owner then asked to drop "(status)": the rows read "RS485 RADAR", "ALS-MPM RADAR", "ลูกลอย".

- **Correction [19:35]:** the card heading changed from "ลูกลอย" to "เซ็นเซอร์วัดระดับน้ำ" at the owner's request (the row "ลูกลอย" stays).

- **Change [19:50]:** the boss said the STM32 reads RS485 RADAR first, then ALS-MPM RADAR, then the floats, and RS485 is in use now. The card lists the three sources in that order: RS485 "ใช้อยู่", the other two "สำรอง" (unknown when telemetry is stale), then the F1-F3 inputs under a rule with the diagram names. This replaces the rename of f1/f2 to radar names (f1/f2 are float bits, so showing them as radar status was wrong). Limit: the frame has no active-source byte, so a firmware fallback is not visible; asked for a firmware change.
