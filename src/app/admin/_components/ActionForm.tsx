"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import Modal from "@/components/Modal";
import type { AdminState } from "../actions";

type Action = (prev: AdminState, form: FormData) => Promise<AdminState>;

/** A form bound to a Server Action that shows the action's { error } in a modal (same pattern as LoginForm).
 *  `confirm` (when set) asks for confirmation in a modal before submitting; cancelling prevents the submit.
 *  `onSuccess` fires once per submit that ended without an error — e.g. to close a dialog around the form.
 *  `resetOnSuccess` clears the fields after a successful submit (create-forms that stay mounted). */
export default function ActionForm({
  action,
  className,
  children,
  confirm,
  onSuccess,
  resetOnSuccess,
}: {
  action: Action;
  className?: string;
  children: ReactNode;
  confirm?: string;
  onSuccess?: () => void;
  resetOnSuccess?: boolean;
}) {
  // WHY {} and not undefined: create-actions return undefined on success, so undefined must stay
  // distinguishable from "nothing submitted yet" — success is undefined, the initial state is {}.
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  // WHY: set right before requestSubmit() so the onSubmit below lets exactly that one submit through.
  const confirmed = useRef(false);
  const [asking, setAsking] = useState(false);
  // WHY: keyed to the state object, not the text, so the same error again after a dismiss reopens the modal.
  const [dismissed, setDismissed] = useState<unknown>(null);
  // WHY: the success handler arrives as a fresh closure every render; keep the effect on the state alone.
  const successRef = useRef(onSuccess);
  useEffect(() => {
    successRef.current = onSuccess;
  });
  useEffect(() => {
    if (state !== undefined) return;
    successRef.current?.();
    if (resetOnSuccess) formRef.current?.reset();
  }, [state, resetOnSuccess]);
  // WHY: the submit buttons are server-rendered children, so pending cannot be passed as a prop.
  // Syncing it onto the buttons keeps the auth-form contract (disabled + aria-busy, cf. LoginForm)
  // without restructuring the admin pages: after a confirm modal closes, the page no longer sits dead.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const button of form.querySelectorAll<HTMLButtonElement>('button[type="submit"]')) {
      button.disabled = pending;
      if (pending) button.setAttribute("aria-busy", "true");
      else button.removeAttribute("aria-busy");
    }
  }, [pending]);

  return (
    <>
      <form
        ref={formRef}
        action={formAction}
        className={className}
        onSubmit={(e) => {
          if (!confirm) return;
          if (confirmed.current) {
            confirmed.current = false;
            return;
          }
          e.preventDefault();
          setAsking(true);
        }}
      >
        {children}
      </form>
      {confirm && (
        <Modal
          open={asking}
          onClose={() => setAsking(false)}
          title={confirm}
          tone="danger"
          confirm={{
            label: "ยืนยัน",
            onConfirm: () => {
              confirmed.current = true;
              formRef.current?.requestSubmit();
              setAsking(false);
            },
          }}
        />
      )}
      <Modal
        open={!!state?.error && dismissed !== state}
        onClose={() => setDismissed(state)}
        title="ดำเนินการไม่สำเร็จ"
        tone="danger"
      >
        {state?.error}
      </Modal>
    </>
  );
}
