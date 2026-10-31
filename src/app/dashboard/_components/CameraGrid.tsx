import { Video } from "lucide-react";
import Go2RTCPlayer from "@/components/Go2RTCPlayer";
import { CAMERAS } from "@/lib/gates";

export default function CameraGrid() {
  return (
    <section
      aria-labelledby="cameras-heading"
      className="mx-auto mb-6 grid w-full max-w-7xl grid-cols-1 gap-4 px-4 pt-6 sm:px-6 md:grid-cols-3 lg:px-8"
    >
      <h2 id="cameras-heading" className="card-title px-1 md:col-span-3">
        <Video className="size-4 text-accent" aria-hidden="true" />
        Live cameras
      </h2>
      {CAMERAS.map((src) => (
        <div
          key={src}
          id={`camera-stream-${src}`}
          className="aspect-video overflow-hidden rounded-xl border border-border bg-black"
        >
          <Go2RTCPlayer streamName={src} label={`Office-${src.replace("office", "")}`} />
        </div>
      ))}
    </section>
  );
}
