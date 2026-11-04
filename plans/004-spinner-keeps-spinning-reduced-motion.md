# 004 — Let the command spinner keep spinning under reduced motion

- **Status**: TODO
- **Commit**: 45ad2c7
- **Severity**: MEDIUM
- **Category**: Accessibility / cohesion with the documented motion policy
- **Estimated scope**: 1 file, 2 class edits

## Problem

`src/components/DeviceSwitch.tsx` guards its two command spinners with Tailwind's
`motion-reduce:animate-none`, which freezes them for reduced-motion users and contradicts the
repo's own documented policy:

```tsx
// src/components/DeviceSwitch.tsx:55 — current (StatusLine "sending" phase)
        <span className="inline-flex items-center gap-2 text-muted">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" strokeWidth={1.75} aria-hidden="true" />
          กำลังส่ง: {label}…
        </span>
```

```tsx
// src/components/DeviceSwitch.tsx:131 — current (in-button spinner while the command is on the wire)
        {sendingThis ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" strokeWidth={2} aria-hidden="true" />
        ) : (
```

Why it breaks: under `prefers-reduced-motion: reduce`, the `motion-reduce:animate-none` variant
emits `animation: none` — which sets `animation-name: none`. The global reduced-motion block in
`src/app/globals.css:272-281` pins `animation-duration` and `animation-iteration-count` with
`!important` and explicitly rescues bare `animate-spin`:

```css
/* src/app/globals.css:254-255 (policy comment) and :279-282 (rescue) */
/* ...Spinners keep spinning (they communicate loading); nothing else loops. */
.animate-spin {
  animation-duration: 1s !important;
  animation-iteration-count: infinite !important;
}
```

—but nothing re-sets `animation-name`, so on these two Loader2 icons the animation stays dead and
the arc renders as a static broken circle. The two other spinners in the app do keep spinning via
the global rescue, because they use bare `animate-spin`:

```tsx
// src/components/Go2RTCPlayer.tsx:254 — current (correct exemplar)
          <div className="size-8 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
```

(so does `src/components/WaterGateMapLoader.tsx:11`). Three loading indicators, two behaviors — and
the frozen ones are exactly where a reduced-motion user watches whether their device command went
out. The cost is high-frequency: every device command on the control panel.

## Target

Both Loader2 icons use bare `animate-spin`, exactly like the camera and map spinners, so the global
rescue applies uniformly:

```tsx
// src/components/DeviceSwitch.tsx:55 — target
          <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />
```

```tsx
// src/components/DeviceSwitch.tsx:131 — target
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
```

## Repo conventions to follow

- Imitate `src/components/Go2RTCPlayer.tsx:254` and `src/components/WaterGateMapLoader.tsx:11`:
  loading spinners in this app are bare `animate-spin` and rely on the documented global rescue
  (`globals.css:279-282`) to keep spinning at 1 s under reduced motion.
- No `motion-reduce:` variant is needed on a spinner anywhere in this codebase.

## Steps

1. `src/components/DeviceSwitch.tsx:55` — change
   `className="size-4 animate-spin motion-reduce:animate-none"` to
   `className="size-4 animate-spin"`.
2. `src/components/DeviceSwitch.tsx:131` — change
   `className="size-4 animate-spin motion-reduce:animate-none"` to
   `className="size-4 animate-spin"`.
3. Grep `src/` for `motion-reduce:animate-none` and confirm zero matches remain.

## Boundaries

- Do NOT touch the `animate-spin` elements in `Go2RTCPlayer.tsx` or `WaterGateMapLoader.tsx` — they
  are already correct.
- Do NOT modify `globals.css` — the reduced-motion block is correct as written; only the component
  classes conflict with it.
- Do NOT change `strokeWidth`, sizes, or the surrounding text/cursors.
- If the excerpts above do not match the file you find (drift since commit `45ad2c7`), STOP and
  report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes; `npm run lint` passes; `npm run test` passes.
- **Feel check**: run the app:
  - DevTools → Rendering panel → "Emulate CSS media feature prefers-reduced-motion" → reduce.
  - Open the dashboard control panel and press any device command (e.g. สั่งเปิด on ปั๊มหลัก): the
    Loader2 arc inside the pressed segment SPINS, and the status line's arc spins too — matching
    the camera tiles' behavior.
  - Toggle the emulation off: nothing changes visually (1 s spin in both modes).
- **Done when**: all three spinner sites behave identically under reduced motion, per the
  documented policy "Spinners keep spinning".
