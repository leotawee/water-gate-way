"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The filter bar for admin lists: a GET form over the current route, so every filter lives in the
 * URL — shareable, back-button safe, and applied on the server. Selects submit as soon as they
 * change; a text field submits after a short pause. Progressive: with JS off it still works via
 * Enter or the form's submit button.
 */
export default function FilterForm({
  ariaLabel,
  className,
  children,
}: {
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <form
      ref={ref}
      method="get"
      action=""
      aria-label={ariaLabel}
      className={className}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) {
          ref.current?.requestSubmit();
          return;
        }
        const el = e.target;
        if (el instanceof HTMLInputElement && (el.type === "search" || el.type === "text")) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => ref.current?.requestSubmit(), 400);
        }
      }}
    >
      {children}
    </form>
  );
}
