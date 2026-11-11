"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * The filter bar for admin lists: filters live in the URL — shareable, back-button safe, applied
 * on the server — but a change calls router.push() instead of submitting a GET form, so the swap
 * is a client transition (ViewTransition fade) and never reloads the document.
 * FilterSelect submits as soon as a value changes; a text field submits after a short pause.
 */
const FilterFormContext = createContext<{ submit: () => void } | null>(null);

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
  const router = useRouter();
  const pathname = usePathname();

  const submit = useCallback(() => {
    const form = ref.current;
    if (!form) return;
    // Same serialization rule a GET form uses: named controls only, empty values omitted —
    // so a cleared field removes its param from the URL, exactly like the old native submit.
    const params = new URLSearchParams();
    for (const el of Array.from(form.elements)) {
      if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLSelectElement)) continue;
      if (!el.name || el.disabled || !el.value) continue;
      params.set(el.name, el.value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, router]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <FilterFormContext.Provider value={{ submit }}>
      <form
        ref={ref}
        aria-label={ariaLabel}
        className={className}
        onSubmit={(e) => {
          // Enter in a text field lands here; route it through the same client transition.
          e.preventDefault();
          submit();
        }}
        onChange={(e) => {
          // Selects submit themselves through FilterSelect; time pickers submit as soon as a full
          // time is chosen; here only the debounced text fields.
          const el = e.target;
          if (el instanceof HTMLSelectElement) return;
          if (el instanceof HTMLInputElement) {
            if (el.type === "time" && el.value) {
              submit();
              return;
            }
            if (el.type === "search" || el.type === "text") {
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(submit, 400);
            }
          }
        }}
      >
        {children}
      </form>
    </FilterFormContext.Provider>
  );
}

const ALL = "__all__";

type Option = { value: string; label: string };

/** Radix Select wired into the URL state. Radix forbids an empty-string item value, so this carries
 *  the value in its own hidden input ("__all__" serializes as "" = filter off) and submits on change.
 *  `key` on Select remounts it when the URL value changes elsewhere, keeping the visible label in
 *  sync with server state. */
export function FilterSelect({
  name,
  value,
  options,
  ariaLabel,
  className,
}: {
  name: string;
  /** Current URL value; "" means the filter is off. */
  value: string;
  options: Option[];
  ariaLabel: string;
  className?: string;
}) {
  const ctx = useContext(FilterFormContext);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const current = value || "";

  return (
    <>
      <input type="hidden" name={name} value={current} ref={hiddenRef} />
      <Select
        key={current}
        defaultValue={current === "" ? ALL : current}
        onValueChange={(v) => {
          if (hiddenRef.current) hiddenRef.current.value = v === ALL ? "" : v;
          ctx?.submit();
        }}
      >
        <SelectTrigger aria-label={ariaLabel} className={className ?? "w-full"}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value === "" ? ALL : o.value} value={o.value === "" ? ALL : o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
