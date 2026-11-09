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
