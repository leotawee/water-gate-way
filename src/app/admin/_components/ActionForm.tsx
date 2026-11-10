"use client";

import { useActionState, useEffect, useRef, useState, type ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { AdminState } from "../actions";

type Action = (prev: AdminState, form: FormData) => Promise<AdminState>;
type Tone = "danger" | "warn" | "info";

const TONE: Record<Tone, { Icon: typeof CircleAlert; chip: string }> = {
  danger: { Icon: CircleAlert, chip: "bg-danger-soft text-danger" },
  warn: { Icon: TriangleAlert, chip: "bg-warn-soft text-warn" },
  info: { Icon: Info, chip: "bg-tint-blue text-accent" },
};

/** A form bound to a Server Action that shows the action's { error } in an alert dialog (shadcn/Radix).
 *  `confirm` (when set) asks for confirmation before submitting; cancelling prevents the submit.
 *  `confirmTone` colors that dialog — danger for destructive actions (default), info for creations.
 *  `onSuccess` fires once per submit that ended without an error — e.g. to close a dialog around the form.
 *  `resetOnSuccess` clears the fields after a successful submit (create-forms that stay mounted). */
export default function ActionForm({
  action,
  className,
  children,
  confirm,
  confirmTone = "danger",
  onSuccess,
  resetOnSuccess,
}: {
  action: Action;
  className?: string;
  children: ReactNode;
  confirm?: string;
  confirmTone?: Tone;
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
  // WHY: keyed to the state object, not the text, so the same error again after a dismiss reopens the dialog.
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
  // without restructuring the admin pages: after a confirm dialog closes, the page no longer sits dead.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    for (const button of form.querySelectorAll<HTMLButtonElement>('button[type="submit"]')) {
      button.disabled = pending;
      if (pending) button.setAttribute("aria-busy", "true");
      else button.removeAttribute("aria-busy");
    }
  }, [pending]);

  const Confirm = confirm ? TONE[confirmTone] : null;

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

      {confirm && Confirm && (
        <AlertDialog
          open={asking}
          onOpenChange={(open) => {
            if (!open) setAsking(false);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogMedia className={Confirm.chip}>
                <Confirm.Icon strokeWidth={1.75} />
              </AlertDialogMedia>
              <AlertDialogTitle>{confirm}</AlertDialogTitle>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
              <AlertDialogAction
                variant={confirmTone === "danger" ? "destructive" : "default"}
                onClick={() => {
                  confirmed.current = true;
                  formRef.current?.requestSubmit();
                }}
              >
                ยืนยัน
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <AlertDialog
        open={!!state?.error && dismissed !== state}
        onOpenChange={(open) => {
          if (!open) setDismissed(state);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-danger-soft text-danger">
              <CircleAlert strokeWidth={1.75} />
            </AlertDialogMedia>
            <AlertDialogTitle>ดำเนินการไม่สำเร็จ</AlertDialogTitle>
            <AlertDialogDescription>{state?.error}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>ตกลง</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
