"use client";

import { useActionState, type ReactNode } from "react";
import type { AdminState } from "../actions";

type Action = (prev: AdminState, form: FormData) => Promise<AdminState>;

/** A form bound to a Server Action that shows the action's { error } inline (same pattern as LoginForm). */
export default function ActionForm({
  action,
  className,
  children,
}: {
  action: Action;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
