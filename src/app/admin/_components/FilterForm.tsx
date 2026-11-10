"use client";

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * The filter bar for admin lists: a GET form over the current route, so every filter lives in the
 * URL — shareable, back-button safe, and applied on the server. FilterSelect submits as soon as a
 * value changes; a text field submits after a short pause. Progressive: with JS off the form still
 * works via Enter and native controls.
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

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <FilterFormContext.Provider value={{ submit: () => ref.current?.requestSubmit() }}>
      <form
        ref={ref}
        method="get"
        action=""
        aria-label={ariaLabel}
        className={className}
        onChange={(e) => {
          // Selects submit themselves through FilterSelect; here only the debounced text fields.
          const el = e.target;
          if (el instanceof HTMLSelectElement) return;
          if (el instanceof HTMLInputElement && (el.type === "search" || el.type === "text")) {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => ref.current?.requestSubmit(), 400);
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

/** Radix Select wired into the GET form. Radix forbids an empty-string item value and its hidden
 *  select is POST-only, so this carries the value in its own hidden input ("__all__" serializes as
 *  "" = filter off) and submits the form on change. `key` on Select remounts it when the URL value
 *  changes elsewhere, keeping the visible label in sync with server state. */
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
