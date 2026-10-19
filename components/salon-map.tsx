"use client";

import { useEffect, useRef } from "react";
import type { LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { normalizeDistrict } from "@/lib/districts";
import { CITY_CENTRE, DISTRICT_CENTRES } from "@/lib/district-centres";

export type SalonPin = {
  id: string;
  salon: string;
  slug: string;
  branch: string;
  address: string;
  lat: number;
  lng: number;
};

// Popup text is built from DOM nodes so salon data is never parsed as HTML.
function popup(pin: SalonPin) {
  const root = document.createElement("div");
  root.className = "hx-pin-popup";
  const name = document.createElement("strong");
  name.textContent = pin.salon;
  root.append(name);
  const where = [pin.branch !== pin.salon && pin.branch, pin.address]
    .filter(Boolean)
    .join(" · ");
  if (where) {
    const small = document.createElement("small");
    small.textContent = where;
    root.append(small);
  }
  const link = document.createElement("a");
  link.href = `/${pin.slug}/book`;
  link.textContent = "Цаг захиалах";
  root.append(link);
  return root;
}

export function SalonMap({
  pins,
  district,
}: {
  pins: SalonPin[];
  district: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const leaflet = useRef<typeof import("leaflet") | null>(null);

  // Leaflet reads `window` on import, so it loads only in the browser.
  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((L) => {
      if (cancelled || !box.current || map.current) return;
      leaflet.current = L;
      map.current = L.map(box.current, {
        scrollWheelZoom: false,
        attributionControl: true,
      }).setView([CITY_CENTRE[0], CITY_CENTRE[1]], CITY_CENTRE[2]);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      show();
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function show() {
    const L = leaflet.current;
    if (!L || !map.current || !layer.current) return;
    layer.current.clearLayers();
    const icon = L.divIcon({
      className: "hx-pin",
      html: "<span></span>",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -26],
    });
    for (const pin of pins)
      L.marker([pin.lat, pin.lng], { icon, title: pin.salon })
        .bindPopup(popup(pin))
        .addTo(layer.current);
    if (pins.length > 1)
      map.current.fitBounds(
        L.latLngBounds(pins.map((p) => [p.lat, p.lng])),
        { padding: [40, 40], maxZoom: 15 },
      );
    else if (pins.length === 1)
      map.current.setView([pins[0].lat, pins[0].lng], 15);
    else {
      const known = normalizeDistrict(district);
      const [lat, lng, zoom] = known ? DISTRICT_CENTRES[known] : CITY_CENTRE;
      map.current.setView([lat, lng], zoom);
    }
  }

  // A new district or search brings new pins without remounting the map.
  useEffect(show, [pins, district]);

  return (
    <div
      ref={box}
      className="hx-map-canvas"
      role="region"
      aria-label={
        district
          ? `${district} дүүргийн салонууд газрын зураг дээр`
          : "Салонууд газрын зураг дээр"
      }
    />
  );
}
