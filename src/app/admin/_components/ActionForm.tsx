"use client";

import { useActionState, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import type { AdminState } from "../actions";

type Action = (prev: AdminState, form: FormData) => Promise<AdminState>;

/** A form bound to a Server Action that shows the action's { error } inline (same pattern as LoginForm).
 *  `confirm` (when set) asks for confirmation before submitting; cancelling prevents the submit. */
export default function ActionForm({
  action,
  className,
  children,
  confirm,
}: {
  action: Action;
  className?: string;
  children: ReactNode;
  confirm?: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      {state?.error && (
        <p role="alert" className="col-span-full flex items-center gap-2 text-sm font-medium text-danger">
          <CircleAlert className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
          {state.error}
        </p>
      )}
    </form>
  );
}
