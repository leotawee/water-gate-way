"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useRouter } from "next/navigation";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

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

/* ── gate data ── */
interface WaterGate {
  name: string;
  lat: number;
  lng: number;
}

const GATES: WaterGate[] = [
  { name: "Gate 1 - Nam Ping", lat: 18.795, lng: 99.015 },
  { name: "Gate 2 - Huay Kaew", lat: 18.81, lng: 98.948 },
  { name: "Gate 3 - Mae Kuang", lat: 18.895, lng: 99.18 },
  { name: "Gate 4 - Mae Rim", lat: 18.926, lng: 98.94 },
  { name: "Gate 5 - Hang Dong", lat: 18.684, lng: 98.92 },
];

export default function WaterGateMap() {
  const router = useRouter();

  const handleMarkerClick = (gateName: string) => {
    router.push(`/dashboard?location=${encodeURIComponent(gateName)}`);
  };

  return (
    <MapContainer
      center={[18.7883, 98.9853]}
      zoom={11}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {GATES.map((gate) => (
        <Marker
          key={gate.name}
          position={[gate.lat, gate.lng]}
          eventHandlers={{
            click: () => handleMarkerClick(gate.name),
          }}
        >
          <Popup>
            <div className="text-sm font-semibold text-gray-800">
              {gate.name}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Click marker to open dashboard
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
