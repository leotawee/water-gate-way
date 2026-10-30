import Go2RTCPlayer from "@/components/Go2RTCPlayer";
import { CAMERAS } from "@/lib/gates";

export default function CameraGrid() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full pt-6">
      {CAMERAS.map((src) => (
        <div
          key={src}
          id={`camera-stream-${src}`}
          className="aspect-video rounded-2xl overflow-hidden shadow-2xl border-2 border-gray-800 bg-black"
        >
          <Go2RTCPlayer streamName={src} label={`Office-${src.replace("office", "")}`} />
        </div>
      ))}
    </section>
  );
}
