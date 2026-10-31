"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useRouter } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Gate } from "@/lib/gates";

/* ── fix default marker icon in bundled environments (Next.js/Webpack) ── */
const iconRetinaUrl =
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png";
const iconUrl =
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png";
const shadowUrl =
  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png";

// @ts-expect-error – internal Leaflet property
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl });

export default function WaterGateMap({ gates }: { gates: Gate[] }) {
  const router = useRouter();

  const handleMarkerClick = (gateId: string) => {
    router.push(`/dashboard?gate=${encodeURIComponent(gateId)}`);
  };

  return (
    <MapContainer
      className="wg-map"
      center={[18.7883, 98.9853]}
      zoom={11}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {gates.map((gate) => (
        <Marker
          key={gate.id}
          position={[gate.lat, gate.lng]}
          eventHandlers={{
            click: () => handleMarkerClick(gate.id),
          }}
        >
          <Popup>
            <div className="text-sm font-semibold text-fg">
              {gate.name}
            </div>
            <div className="text-xs text-muted mt-1">
              Click marker to open dashboard
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
