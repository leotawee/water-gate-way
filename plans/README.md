# Animation improvement plans

Produced by the `improve-animations` audit of water-gate-way at commit `45ad2c7`
(2026-11-04). Every plan is self-contained — execute with
`improve-animations execute <plan>` or hand any plan to any agent with zero context.

## Plans

| # | Plan | Severity | Files | Status |
|---|------|----------|-------|--------|
| 001 | [Admin submit pending feedback](001-admin-submit-pending-feedback.md) | MEDIUM | ActionForm.tsx, globals.css | TODO |
| 002 | [Camera overlay transition-driven visibility](002-camera-overlay-transition-visibility.md) | MEDIUM | Go2RTCPlayer.tsx, globals.css | TODO |
| 003 | [Reserved Caps Lock status line](003-capslock-reserved-status-line.md) | MEDIUM | PasswordField.tsx | TODO |
| 004 | [Spinner keeps spinning under reduced motion](004-spinner-keeps-spinning-reduced-motion.md) | MEDIUM | DeviceSwitch.tsx | TODO |
| 005 | [Chart tooltip instant tracking](005-chart-tooltip-instant-tracking.md) | MEDIUM | WaterLevelChart.tsx | TODO |

## Recommended execution order

1. **004** (2 class deletions) and **005** (1 prop) — trivial, independent, immediate feel wins.
2. **003** — single-file layout fix, no dependencies.
3. **001** — component + one CSS rule; verify the auth forms still look right afterward (they
   intentionally inherit the new `[aria-busy]` styling).
4. **002** — largest edit (JSX region replacement + one CSS block); run last so its verification can
   ride on a stable dashboard.

No plan depends on another; the order above only front-loads the cheap wins. Plans 001 and 002 both
append rules to `globals.css` — merge conflicts are unlikely (different regions) but rebase order
001 → 002 is safest.

## Deferred findings (audited, not planned yet)

LOW-severity items from the same audit, ready to plan on request: `duration-150` token sweep (13
sites), half-animated state dots (StatePill/DeviceSwitch/Go2RTCPlayer), stale↔live muting snap,
modal `overlay/display` duration pairing (one-line latent fix), eye-toggle hover/press feedback,
dead `.anim-shake`/`.anim-pop-in` + stale DESIGN.md motion contract, users-page disclosure
chevron, admin per-route skeletons. Plus four missed opportunities: StatusLine phase rise, chart
empty→data fade, Leaflet popup fade, map-loader reveal.

## Status legend

`TODO` — not started · `DONE` — executed and verified · `DROPPED` — declined by the user.
