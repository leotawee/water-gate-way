# 003 — Reserve the Caps Lock status line so it never shoves the layout

- **Status**: TODO
- **Commit**: 45ad2c7
- **Severity**: MEDIUM
- **Category**: Physicality & origin / preventing a jarring change
- **Estimated scope**: 1 file, ~10 lines

## Problem

`src/components/PasswordField.tsx` mounts the Caps Lock warning conditionally, in normal flow, with
no reserved space. Toggling Caps Lock on shoves everything below the field down ~26 px in one frame
(on login: the submit button; on register: the second password field), and toggling off snaps it
back:

```tsx
// src/components/PasswordField.tsx:74-80 — current
      {hint}
      {caps && (
        <p role="status" className="anim-fade-in mt-1.5 flex items-center gap-2 text-sm font-bold text-warn">
          <TriangleAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          เปิด Caps Lock อยู่ รหัสผ่านอาจพิมพ์เป็นตัวพิมพ์ใหญ่
        </p>
      )}
```

This component renders under: login password (`src/app/login/LoginForm.tsx:43-49`), register
password and confirm password (`src/app/register/RegisterForm.tsx:54-81`) — so the jump can happen
on all three fields. The codebase already established the correct convention — a fixed-height
status line that is always rendered, so state swaps never move layout:

```tsx
// src/components/DeviceSwitch.tsx:182-187 — current (the exemplar)
      {/* Reserved status line: always rendered at one fixed height, empty when idle. */}
      {!readOnly && (
        <p className="mt-1.5 flex min-h-5 items-center gap-2 pl-[3.25rem] text-sm" aria-live="polite">
          {status && <StatusLine status={status} label={commandLabel(status.cmd)} onRetry={() => onSend(status.cmd)} />}
        </p>
      )}
```

## Target

The warning line is always rendered at one fixed height (`min-h-5` = 20 px + `mt-1.5` = 6 px,
matching the exemplar); only its content appears and disappears. The content swap is instant —
per-keystroke feedback reads faster than a 180 ms fade, and the exemplar (StatusLine) swaps
instantly in its reserved line too:

```tsx
// src/components/PasswordField.tsx:74 — target
      {hint}
      {/* Reserved status line (cf. DeviceSwitch StatusLine): always one fixed height so toggling
          Caps Lock never shoves the layout. WHY no fade: per-keystroke feedback — the text appearing
          in place reads faster than a 180 ms fade. */}
      <p role="status" className="mt-1.5 flex min-h-5 items-center gap-2 text-sm font-bold text-warn">
        {caps && (
          <>
            <TriangleAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            เปิด Caps Lock อยู่ รหัสผ่านอาจพิมพ์เป็นตัวพิมพ์ใหญ่
          </>
        )}
      </p>
```

Screen-reader behavior is preserved: `role="status"` on a persistent live region announces when
content is inserted (when Caps Lock turns on) and stays silent while empty.

Accepted layout change: each PasswordField is permanently ~26 px taller. On the login card
(`max-w-sm`) and register card there is ample room for one (login) / two (register) reserved lines.

## Repo conventions to follow

- `min-h-5` + `mt-1.5` + `flex items-center gap-2` — copy the exact spacing grammar from the
  exemplar at `src/components/DeviceSwitch.tsx:184` (without its `pl-[3.25rem]` icon gutter, which
  exists only for the device-row icon alignment).
- `role="status"` stays on the `<p>` (it is today).

## Steps

1. `src/components/PasswordField.tsx` — replace lines 74-80 (the `{hint}` line stays; the
   conditional `{caps && ...}` block is replaced) with the Target block above.
2. Confirm the `TriangleAlert` import is still used (it is — inside the new block) and no other
   part of the component changed.

## Boundaries

- Do NOT touch the visibility-toggle button or the eye icon swap (a separate plan covers it).
- Do NOT animate the line's height (no grid-rows/max-height transition) — the reserved line is the
  settled repo convention; animating size is a layout animation this codebase reserves for the
  `<details>` disclosure mechanism.
- Do NOT remove the `hint` prop rendering above the reserved line.
- Do NOT touch LoginForm/RegisterForm — they render PasswordField as-is and need no changes.
- If the file you find does not match the current-code excerpt (drift since commit `45ad2c7`),
  STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes; `npm run lint` passes; `npm run test` passes
  (`src/lib/capsLock.test.ts` is untouched and must stay green).
- **Feel check**: run the app:
  - On /login, focus the password field and toggle Caps Lock on/off repeatedly: the submit button
    and the "จดจำฉันไว้ในอุปกรณ์นี้" label below DO NOT MOVE at all; only the warning text appears
    and disappears inside its fixed slot.
  - On /register, toggle Caps Lock in both password fields: neither field's neighbor moves.
  - With a screen reader (or by watching the accessibility tree in DevTools), turning Caps Lock on
    announces the warning once; turning it off announces nothing.
- **Done when**: no layout shift occurs under any Caps Lock toggling on any of the three password
  fields, and the warning still communicates (text + icon + warn color).
