/** Connection state as dot + word (never colour alone), same vocabulary as the status strip. */
export default function LiveIcon({ live }: { live: boolean }) {
  return live ? (
    <span className="pill bg-on-soft text-on">
      <span className="size-2 rounded-full bg-on" aria-hidden="true" />
      ออนไลน์
    </span>
  ) : (
    <span className="pill bg-danger-soft text-danger">
      <span className="size-2 rounded-full bg-danger" aria-hidden="true" />
      ขาดการเชื่อมต่อ
    </span>
  );
}
