"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { normalizeDistrict } from "@/lib/districts";
import { CITY_CENTRE, DISTRICT_CENTRES } from "@/lib/district-centres";

type Point = { lat: number; lng: number } | null;
const round = (n: number) => Math.round(n * 1e6) / 1e6;

// Click or drag a pin to set a branch's coordinates; the form reads them from
// the hidden `latitude` and `longitude` inputs.
export function LocationPicker({
  initial,
  district,
}: {
  initial: Point;
  district: string;
}) {
  const [point, setPoint] = useState<Point>(initial);
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const place = useRef<(p: Point) => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !box.current || map.current) return;
      const known = normalizeDistrict(district);
      const [lat, lng, zoom] = initial
        ? [initial.lat, initial.lng, 16]
        : known
          ? DISTRICT_CENTRES[known]
          : CITY_CENTRE;
      const m = L.map(box.current, { scrollWheelZoom: false }).setView(
        [lat, lng],
        zoom,
      );
      map.current = m;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(m);
      const icon = L.divIcon({
        className: "map-pin",
        html: "<span></span>",
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      place.current = (p) => {
        if (!p) {
          marker.current?.remove();
          marker.current = null;
        } else if (marker.current) marker.current.setLatLng(p);
        else {
          marker.current = L.marker(p, { icon, draggable: true }).addTo(m);
          marker.current.on("dragend", () => {
            const at = marker.current!.getLatLng();
            setPoint({ lat: round(at.lat), lng: round(at.lng) });
          });
        }
        setPoint(p && { lat: round(p.lat), lng: round(p.lng) });
      };
      if (initial) place.current(initial);
      m.on("click", (e) => place.current(e.latlng));
      // The dialog may still be laying out when the map mounts.
      setTimeout(() => m.invalidateSize(), 50);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      marker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Choosing another district moves the view there until a pin is placed.
  useEffect(() => {
    const known = normalizeDistrict(district);
    if (!map.current || point || !known) return;
    const [lat, lng, zoom] = DISTRICT_CENTRES[known];
    map.current.setView([lat, lng], zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  return (
    <div className="field location-picker">
      <span>Газрын зураг дээрх байршил</span>
      <div
        ref={box}
        className="location-picker-map"
        role="application"
        aria-label="Салбарын байршлыг газрын зураг дээр дарж тэмдэглэх"
      />
      <input type="hidden" name="latitude" value={point?.lat ?? ""} />
      <input type="hidden" name="longitude" value={point?.lng ?? ""} />
      <small>
        {point
          ? `Тэмдэглэсэн: ${point.lat}, ${point.lng}. Цэгийг чирж засна уу.`
          : "Салбар байрлах газар дээр дарж цэг тавина уу. Ингэснээр нүүр хуудасны газрын зураг дээр таны салон харагдана."}
      </small>
      {point && (
        <button
          type="button"
          className="link-button"
          onClick={() => place.current(null)}
        >
          Байршлыг арилгах
        </button>
      )}
    </div>
  );
}
