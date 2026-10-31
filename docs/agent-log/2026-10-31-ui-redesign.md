# UI redesign: dark operations console (2026-10-31)

Visual and markup only. No logic, props, server actions, API routes, or form names changed.

## [--:--] Tokens, fonts, shared header
- **Action:** src/app/globals.css (@theme tokens, @utility card/btn/input-field/pill, reduced-motion, leaflet dark), src/app/layout.tsx (IBM Plex Sans Thai + Mono, lang th), src/components/AppHeader.tsx (new)
- **Why:** one token set; Tailwind v4 `@theme` yields bg-surface/text-muted classes. Tailwind v4 defaults borders to currentColor, so the base border colour is set in `@layer base`; an unlayered `*` rule would override utilities.
- **Result:** not yet run at this point; verified later (see Summary).
- **Lesson:** unlayered CSS beats `@layer utilities`; keep global resets inside `@layer base`.

## [--:--] Dashboard, map, login, admin markup
- **Action:** dashboard header/cards/chart/controls/camera player, map page + loader, login page + form, admin overview/users/gates/nav/ActionForm
- **Why:** shared card/button/pill classes keep one look. Status is always icon + text. Recharts props use hex constants because SVG attributes cannot read CSS variables.
- **Result:** vitest 298/298 passed; eslint clean; tsc clean outside scripts/dev.
- **Lesson:** `npm run build` type-checks every .ts in the repo, so a broken untracked script blocks the build even when the app is fine.

## Summary
- Changed: globals.css, layout.tsx, page.tsx, AppHeader.tsx (new), dashboard/DashboardClient.tsx and _components/*, DashboardHeaderClient.tsx, Go2RTCPlayer.tsx (JSX only), WaterGateMap.tsx, WaterGateMapLoader.tsx, login/*, admin/*
- Unchanged: src/lib, src/hooks, src/proxy.ts, src/app/api, liveLag.ts, Go2RTCPlayer logic, scripts/, Diagram/, IDEA.md
- Remaining: `npm run build` fails on pre-existing scripts/dev/db-inspect.ts type errors (untracked, not touched)
- Key decisions: `btn-danger` (outline) for every "off"/stop action, `btn-primary` (accent) for "on"; wire colours kept as palette classes
- Top 3 lessons: 1. @layer base for global resets. 2. Recharts needs hex constants. 3. Build type-checks scripts too.
- Mistakes & dead ends: first scratch build symlinked node_modules; Turbopack rejected it ("points out of the filesystem root"); a cp -c clone worked.
