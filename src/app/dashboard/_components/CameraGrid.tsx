import Go2RTCPlayer from "@/components/Go2RTCPlayer";
import { CAMERAS } from "@/lib/gates";

/** The camera feeds, two across. The width comes from the dashboard column. */
export default function CameraGrid() {
  return (
    <section aria-labelledby="cameras-heading">
      <h2 id="cameras-heading" className="mb-3 text-base font-bold text-fg">
        กล้องสด
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {CAMERAS.map((src) => (
          <div
            key={src}
            id={`camera-stream-${src}`}
            className="aspect-video overflow-hidden rounded-lg border border-border bg-black"
          >
            <Go2RTCPlayer streamName={src} label={`กล้อง ${src.replace("office", "")}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
