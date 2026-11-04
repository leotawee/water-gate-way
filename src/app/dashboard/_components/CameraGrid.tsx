import Go2RTCPlayer from "@/components/Go2RTCPlayer";
import { CAMERAS } from "@/lib/gates";

/** The camera feeds. WHY: the column count follows the camera count (3 across from 640px), so no cell is orphaned. */
export default function CameraGrid() {
  return (
    <section aria-labelledby="cameras-heading" className="">
      <h2 id="cameras-heading" className="sr-only">
        กล้องสด
      </h2>
      {/* Phone: the three feeds swipe sideways (one screen, not three); from 640 px they sit side by side as drafted. */}
      <div
        tabIndex={0}
        role="group"
        aria-label="กล้องสด 3 ตัว เลื่อนดูได้"
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0"
      >
        {/* WHY: labelled by position (กล้อง 1…), never by the raw stream id. */}
        {CAMERAS.map((src, i) => (
          <div key={src} id={`camera-stream-${src}`} className="aspect-video basis-[88%] shrink-0 snap-center overflow-hidden rounded-2xl bg-black sm:basis-auto">
            <Go2RTCPlayer streamName={src} label={`กล้อง ${i + 1}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
