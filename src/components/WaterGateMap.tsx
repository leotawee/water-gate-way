"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import Link from "next/link";
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

export default function WaterGateMap({ gates }: { gates: (Gate & { location?: string })[] }) {
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
        <Marker key={gate.id} position={[gate.lat, gate.lng]}>
          <Popup>
            <div className="text-sm font-bold text-fg">{gate.name}</div>
            {gate.location && <div className="mt-0.5 text-xs text-muted">{gate.location}</div>}
            <Link
              href={`/dashboard?gate=${encodeURIComponent(gate.id)}`}
              className="btn-primary mt-2 w-full"
            >
              เปิดแดชบอร์ด
            </Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
