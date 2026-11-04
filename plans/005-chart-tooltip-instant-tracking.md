# 005 — Turn off the chart tooltip's follow lag

- **Status**: TODO
- **Commit**: 45ad2c7
- **Severity**: MEDIUM
- **Category**: Easing & duration (UI animations stay under 300 ms; tooltips: 125–200 ms)
- **Estimated scope**: 1 file, 1 prop

## Problem

The water-level chart's `<Tooltip>` in `src/app/dashboard/_components/WaterLevelChart.tsx:158-170`
does not opt out of Recharts' tooltip animation, so the tooltip perpetually lags the pointer:

```tsx
// src/app/dashboard/_components/WaterLevelChart.tsx:158-170 — current
              <Tooltip
                formatter={formatTooltip}
                cursor={{ stroke: CHART.tick, strokeOpacity: 0.4 }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: `1px solid ${CHART.border}`,
                  borderRadius: 6,
                  color: CHART.fg,
                  fontSize: 12,
                }}
                labelStyle={{ color: CHART.tick }}
                itemStyle={{ color: CHART.fg }}
              />
```

Verified against the installed dependency (recharts 3.8.1): the Tooltip component's defaults are
`animationDuration: 400`, `animationEasing: "ease"`, `isAnimationActive: "auto"`
(`node_modules/recharts/types/component/Tooltip.d.ts:190-197`). With `"auto"` the wrapper element
gets a `transform 400ms ease` transition, so on every point-to-point pointer move the tooltip
visibly trails the cursor by 400 ms — over both the general 300 ms UI budget and this repo's own
documented 260 ms ceiling (`src/app/globals.css:113`). The chart's `Line` already opts out of
animation (`WaterLevelChart.tsx:189`); the tooltip is the leftover.

## Target

Add `isAnimationActive={false}` as the first prop, mirroring the Line's opt-out:

```tsx
// src/app/dashboard/_components/WaterLevelChart.tsx — target
              {/* WHY: instant tracking — the default 400ms ease transform makes the tooltip trail
                  the pointer; the Line below already opts out for the same reason. */}
              <Tooltip
                isAnimationActive={false}
                formatter={formatTooltip}
                cursor={{ stroke: CHART.tick, strokeOpacity: 0.4 }}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: `1px solid ${CHART.border}`,
                  borderRadius: 6,
                  color: CHART.fg,
                  fontSize: 12,
                }}
                labelStyle={{ color: CHART.tick }}
                itemStyle={{ color: CHART.fg }}
              />
```

## Repo conventions to follow

- Imitate the adjacent Line (`src/app/dashboard/_components/WaterLevelChart.tsx:183-191`), which
  already passes `isAnimationActive={false}` with an inline WHY comment above the element.
- Do not substitute `animationDuration={150}` or similar: a tuned lag is still a lag; cursor-following
  tooltips read best instant, and this dashboard's personality is crisp (DESIGN.md, Motion section).

## Steps

1. `src/app/dashboard/_components/WaterLevelChart.tsx` — add the WHY comment and
   `isAnimationActive={false}` to the `<Tooltip>` exactly as shown in the Target block.
2. Confirm nothing else in the component changed (the `Line`, `dot={false}`, and polling interval
   are out of scope).

## Boundaries

- Do NOT touch the `<Line>` props (`type="linear"`, `dot={false}`, `isAnimationActive={false}` are
  deliberate, commented decisions).
- Do NOT change the cursor line styling, tooltip content styling, or the CSV download link.
- Do NOT upgrade/downgrade recharts.
- If the excerpt above does not match the file you find (drift since commit `45ad2c7`), STOP and
  report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes; `npm run lint` passes; `npm run build` succeeds.
- **Feel check**: run the app, open the dashboard, hover the ประวัติ 24 ค่าล่าสุด chart:
  - Sweep the pointer across the plot left→right: the tooltip jumps between points instantly, with
    zero trailing/catch-up motion.
  - The dashed cursor line still follows the pointer exactly as before.
  - DevTools → Rendering panel → emulate `prefers-reduced-motion: reduce`: behavior identical
    (correct — this change makes all motion settings behave the same here).
- **Done when**: no transform transition runs on the tooltip wrapper; the tooltip is always exactly
  under the pointer's current point.
