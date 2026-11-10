"use client";

import { useRef, useState } from "react";
import { LogOut, CircleAlert } from "lucide-react";
import { signOut } from "@/app/login/actions";
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

type Props = {
  /** Button look; each header styles its own (ghost on surface, white on the brand bar). */
  className?: string;
  /** Classes for the label span; the dashboard header hides the word on phones. */
  labelClassName?: string;
};

/**
 * Sign-out behind a confirmation modal. WHY: signing out ends the session for the whole device —
 * on the shared site tablet it is one tap away from locking the next operator out — so the
 * destructive action asks once (AlertDialog) and only then submits the server action.
 */
export default function LogoutButton({ className, labelClassName }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [ask, setAsk] = useState(false);

  return (
    <>
      {/* display:contents keeps the header flex layout identical to the old bare form. */}
      <form ref={formRef} action={signOut} className="contents">
        <button
          type="button"
          onClick={() => setAsk(true)}
          className={"cursor-pointer " + (className ?? "")}
        >
          <LogOut className="size-4" strokeWidth={1.75} aria-hidden="true" />
          <span className={labelClassName}>ออกจากระบบ</span>
        </button>
      </form>
      <AlertDialog
        open={ask}
        onOpenChange={(o) => {
          if (!o) setAsk(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-danger-soft text-danger">
              <CircleAlert strokeWidth={1.75} />
            </AlertDialogMedia>
            <AlertDialogTitle>ออกจากระบบ?</AlertDialogTitle>
            <AlertDialogDescription>
              จะต้องเข้าสู่ระบบอีกครั้งเพื่อกลับเข้าหน้าควบคุม
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setAsk(false);
                formRef.current?.requestSubmit();
              }}
            >
              ยืนยันออกจากระบบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}