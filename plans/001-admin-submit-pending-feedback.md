# 001 — Surface pending state on every admin submit

- **Status**: TODO
- **Commit**: 45ad2c7
- **Severity**: MEDIUM
- **Category**: Purpose & frequency (state indication / feedback)
- **Estimated scope**: 2 files, ~15 lines

## Problem

`src/app/admin/_components/ActionForm.tsx:22` wraps every admin Server Action form, but never
destructures `useActionState`'s third element (`pending`). All six admin submit buttons render with
zero in-flight feedback — no disabled state, no dimming, no cursor change:

```tsx
// src/app/admin/_components/ActionForm.tsx:22-28 — current
const [state, formAction] = useActionState(action, undefined);
const formRef = useRef<HTMLFormElement>(null);
// WHY: set right before requestSubmit() so the onSubmit below lets exactly that one submit through.
const confirmed = useRef(false);
const [asking, setAsking] = useState(false);
```

Affected buttons (all render through ActionForm): create user (`src/app/admin/users/page.tsx:58`),
save role (`:115`), save reset password (`:157`), save gate edit (`src/app/admin/gates/page.tsx:83`),
hide/show gate (`:98`), create gate (`:132`).

Worst seam: a destructive confirm. `ActionForm.tsx:54-61` runs `formRef.current?.requestSubmit();
setAsking(false)` — the modal fades out (180 ms) and the page then sits completely unchanged until
the Server Action's RSC refresh lands. Operators cannot tell whether the click registered, so they
click again.

The auth forms already do this correctly — this is the repo's own established pattern:

```tsx
// src/app/login/LoginForm.tsx:54-56 — current (the exemplar)
<button type="submit" disabled={pending} aria-busy={pending} className="btn-primary w-full">
  {pending ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
</button>
```

A second, smaller gap: the disable/disable-account button on the users page
(`src/app/admin/users/page.tsx:169-176`) does not use the `btn` utility, so the utility's
`disabled:opacity-60 disabled:cursor-not-allowed` styling never applies to it.

## Target

1. `pending` destructured in ActionForm; while pending, every `button[type="submit"]` inside that
   form is `disabled` and carries `aria-busy="true"`.
2. One global CSS rule gives every `[aria-busy="true"]` button the same visible treatment
   (60 % opacity, progress cursor) — this covers the users-page ghost button that lacks `btn`'s
   disabled styles, and matches the opacity value already used by the `btn` utility.

```css
/* src/app/globals.css — target, inside the existing `@layer base` block */
[aria-busy="true"] {
  opacity: 0.6;
  cursor: progress;
}
```

```tsx
// src/app/admin/_components/ActionForm.tsx — target
import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
// ...
const [state, formAction, pending] = useActionState(action, undefined);
const formRef = useRef<HTMLFormElement>(null);
// ...
// WHY: the submit buttons are server-rendered children, so pending cannot be passed as a prop.
// Syncing it onto the buttons keeps the LoginForm/RegisterForm contract (disabled + aria-busy)
// without restructuring the admin pages.
useEffect(() => {
  const form = formRef.current;
  if (!form) return;
  for (const button of form.querySelectorAll<HTMLButtonElement>('button[type="submit"]')) {
    button.disabled = pending;
    if (pending) button.setAttribute("aria-busy", "true");
    else button.removeAttribute("aria-busy");
  }
}, [pending]);
```

No label swaps are added — the buttons are server-rendered markup and swapping labels would
require restructuring the admin pages. Disabled + dim + progress cursor is the whole feedback.

## Repo conventions to follow

- The dim value must stay `0.6` — it is the same opacity the `btn` utility already uses for
  `disabled:` (`src/app/globals.css:77`), so `btn`-styled buttons do not change appearance when
  both rules apply.
- Place the new rule inside the existing `@layer base { ... }` block in `src/app/globals.css`
  (alongside `:focus-visible`), not at the file bottom.
- Do not add a spinner icon: this codebase reserves `Loader2` spinners for the per-row command
  lifecycle (`src/components/DeviceSwitch.tsx:55`), a different mechanic.

## Steps

1. `src/app/admin/_components/ActionForm.tsx` — add `useEffect` to the React import; destructure
   `pending` as the third element of `useActionState`; add the sync effect from the Target block
   directly below the `dismissed` state declaration (before the `return`).
2. `src/app/globals.css` — inside `@layer base`, add the `[aria-busy="true"]` rule from the Target
   block.
3. Read the file after editing to confirm the effect sits inside the component and above `return`.

## Boundaries

- Do NOT touch `src/app/login/LoginForm.tsx` or `src/app/register/RegisterForm.tsx` — they already
  handle pending; the new global rule only makes their look consistent.
- Do NOT restructure the admin pages or convert their buttons to client components.
- Do NOT add label swaps, spinners, or new dependencies.
- If `useActionState` in the file you find does not match the excerpt above (drift since commit
  `45ad2c7`), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run typecheck` passes; `npm run test` passes (admin action tests untouched);
  `npm run lint` passes.
- **Feel check**: run the app, sign in as admin:
  - Submit "สร้างผู้ใช้" with a valid email: the button dims to 60 % opacity and shows the progress
    cursor until the row table refreshes, then returns to normal.
  - On /admin/users, press "ปิดใช้งานบัญชี" on any row, confirm in the modal: the modal fades out
    and the underlying button is visibly dimmed while the refresh streams — the dead moment is gone.
  - Keyboard: while pending, Tab cannot focus any dimmed submit button (they are disabled).
- **Done when**: all six admin submit buttons visibly disable during their action, and no double
  click can fire a second submission.
