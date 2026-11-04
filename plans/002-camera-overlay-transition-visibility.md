# 002 — Make camera status overlays transition-driven, never unmount

- **Status**: TODO
- **Commit**: 45ad2c7
- **Severity**: MEDIUM
- **Category**: Interruptibility (rapidly retriggered feedback)
- **Estimated scope**: 2 files, ~40 lines

## Problem

`src/components/Go2RTCPlayer.tsx` conditionally mounts its connecting/failed overlays with a
one-shot keyframe and unmounts them with no exit at all — a one-frame hard cut on the
highest-frequency surface in the app:

```tsx
// src/components/Go2RTCPlayer.tsx:251-272 — current
      {/* Loading */}
      {status === "connecting" && (
        <div className="anim-fade-in absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="size-8 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
        </div>
      )}

      {/* Error. WHY: centred with side padding so the heading clears the status chip at 375px;
          secondary (outline) styling stays readable on black. */}
      {status === "failed" && (
        <div className="anim-fade-in absolute inset-0 flex items-center justify-center bg-black/80 px-4">
          <div className="flex max-w-full flex-col items-center gap-3 text-center">
            <p className="text-sm font-bold text-white">เชื่อมต่อกล้องไม่สำเร็จ</p>
            <button
              onClick={retry}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-white/40 bg-transparent px-4 text-sm font-bold text-white transition-colors duration-150 hover:bg-white/10"
            >
              ลองอีกครั้ง
            </button>
          </div>
        </div>
      )}
```

These overlays retrigger constantly by design: the server ends every stream after 10 minutes
(`Go2RTCPlayer.tsx:168`), failures retry on a 2–30 s backoff (`:68-75`), a stall watchdog
reconnects (`:199-205`), and tab return reconnects (`:82-91`). The repo's own documented policy in
`src/app/globals.css:122` says: *"One-shot appearances (keyframes only here; rapidly retriggered
feedback uses transitions above)."* These overlays are rapidly retriggered feedback using keyframes
for entry and nothing for exit. When the stream starts, `status` flips to `"connected"` on
`onPlaying` (`:219-223`) and the overlay vanishes in one frame — the view snaps from dimmed black
to live video. The connecting↔failed swap likewise teleport-swaps two separately mounted overlays.

## Target

One overlay that never unmounts, whose visibility is a class toggle on a CSS transition, and whose
background/strength differs by status:

```css
/* src/app/globals.css — target, add directly BELOW the `dialog.modal` block (end of file) */
/* Camera status overlay (components/Go2RTCPlayer.tsx): visibility is transition-driven because the
   connecting/failed states flip constantly (10-min server cut, backoff retries, tab return) and the
   motion policy reserves keyframes for one-shot appearances only. 120 ms --ease-out fades; the
   opacity exit is allowed under prefers-reduced-motion (opacity only, no movement). */
.cam-overlay {
  transition:
    opacity var(--dur-fast) var(--ease-out),
    background-color var(--dur-fast) var(--ease-out);
}
```

```tsx
// src/components/Go2RTCPlayer.tsx — target, replaces lines 251-272 verbatim
      {/* WHY one persistent overlay: connecting/failed flip constantly (10-min server cut, backoff,
          tab return); the motion policy (globals.css) reserves keyframes for one-shot appearances, so
          visibility is a class toggle on a never-unmounting overlay instead of conditional mounts. */}
      <div
        aria-hidden={status === "connected" || undefined}
        className={`cam-overlay absolute inset-0 flex items-center justify-center ${
          status === "failed" ? "bg-black/80" : "bg-black/60"
        } ${status === "connected" ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        {status === "connecting" && (
          <div className="size-8 rounded-full border-2 border-white/80 border-t-transparent animate-spin" />
        )}
        {status === "failed" && (
          <div className="flex max-w-full flex-col items-center gap-3 px-4 text-center">
            <p className="text-sm font-bold text-white">เชื่อมต่อกล้องไม่สำเร็จ</p>
            <button
              onClick={retry}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-white/40 bg-transparent px-4 text-sm font-bold text-white transition-colors duration-150 hover:bg-white/10"
            >
              ลองอีกครั้ง
            </button>
          </div>
        )}
      </div>
```

Behavior this produces: stream connects → overlay fades out over 120 ms (`--dur-fast`) revealing
the live feed; stream drops → spinner fades back in; third consecutive failure → content swaps to
the error + retry button while the overlay darkens 60 %→80 % black (both are background-color
transitions on the same element).

## Repo conventions to follow

- Motion values must come from the tokens: `--dur-fast` (120 ms) and `--ease-out`
  (`cubic-bezier(0.23, 1, 0.32, 1)`) are defined at `src/app/globals.css:114-120`.
- Component-scoped CSS blocks live at the end of `globals.css` with a WHY comment — imitate the
  `dialog.modal` block (`src/app/globals.css:289-333`) for placement and comment style.
- The opacity values `bg-black/60` and `bg-black/80` and the retry button's classes are carried
  over unchanged from the current code.
- The status chip (`z-10`, `Go2RTCPlayer.tsx:234-244`) stays above the overlay exactly as today —
  the overlay keeps no z-index of its own.

## Steps

1. `src/app/globals.css` — append the `.cam-overlay` rule block after the `dialog.modal`
   reduced-motion block (after line 333).
2. `src/components/Go2RTCPlayer.tsx` — replace the entire conditional-overlay region (current lines
   251-272, from `{/* Loading */}` through the failed-overlay closing `)}`) with the single
   persistent overlay from the Target block.
3. Confirm the JSX above the region is untouched: the `<video>` (line ~213-230), the status chip
   and the camera-label chip stay exactly as they are.

## Boundaries

- Do NOT touch the `<video>` element, its `key={attempt}`, the status chip, or the camera-label chip.
- Do NOT change the retry button's `duration-150` — duration-token consolidation is a different
  plan; leaving it is intentional.
- Do NOT add an entrance animation for the overlay's first paint: on initial mount the overlay is
  simply visible (the dashboard's `.stagger` already animates the tile container on login).
- Do NOT animate the inner spinner↔error content swap — instant content swap inside the overlay is
  the intended crisp behavior.
- Do NOT add new dependencies or libraries.
- If the file you find does not match the current-code excerpt (drift since commit `45ad2c7`),
  STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes; `npm run lint` passes; `npm run build` succeeds.
- **Feel check**: run the app with all three cameras:
  - On dashboard load, each tile shows the spinner, then the overlay fades OUT smoothly (~120 ms) as
    the feed starts — no one-frame cut.
  - In DevTools → Network set to Offline, wait for a camera to fail: the overlay darkens and the
    error + ลองอีกครั้ง button appear without a flash; restore the network (or press retry): the
    overlay fades to the spinner and then out again.
  - Switch away to another tab and back: reconnect overlays fade in/out, never blink.
  - DevTools → Animations panel at 10 % speed: confirm the fade is a single continuous opacity
    transition, not a keyframe replay.
  - Toggle `prefers-reduced-motion: reduce` in the Rendering panel: overlays still fade briefly
    (opacity-only is allowed under reduced motion); the spinner keeps spinning (documented policy).
- **Done when**: no conditional `anim-fade-in` overlay mounts/unmounts in Go2RTCPlayer; every
  status change is a smooth 120 ms fade.
