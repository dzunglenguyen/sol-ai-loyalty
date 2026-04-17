"use client";

import { useEffect, useRef } from "react";
import type { RankedOffer } from "@/types";

interface Props {
  offers: RankedOffer[];
  userLat: number;
  userLng: number;
  onSelectOffer: (offer: RankedOffer) => void;
}

export default function MerchantMap({ offers, userLat, userLng, onSelectOffer }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    if (!containerRef.current || mapRef.current) return;

    // Dynamically import Leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      if (!isMounted || !containerRef.current) return;

      // If container already has a map initialized, don't re-initialize
      // @ts-ignore
      if (containerRef.current._leaflet_id) {
        console.warn("Map container already has a Leaflet instance.");
        return;
      }

      // Fix default marker icon paths broken by webpack
      // @ts-ignore
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!, {
        center: [userLat, userLng],
        zoom: 15,
        zoomControl: true,
      });

      mapRef.current = map;

      // OpenStreetMap tiles — no API key needed
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      }).addTo(map);

      // User location marker (blue pulsing dot)
      const userIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:16px;height:16px;
          background:#0046BE;
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 0 0 4px rgba(0,70,190,0.25);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker([userLat, userLng], { icon: userIcon })
        .addTo(map)
        .bindPopup("<b>Vị trí của bạn</b>")
        .openPopup();

      // Merchant markers
      offers.forEach((offer) => {
        const lat = offer.campaign.merchant_lat;
        const lng = offer.campaign.merchant_lng;
        if (!lat || !lng) return;

        const merchantIcon = L.divIcon({
          className: "",
          html: `<div style="
            background:#FF6B00;
            color:#1A1A1A;
            font-size:10px;
            font-weight:700;
            padding:4px 8px;
            border-radius:50px;
            white-space:nowrap;
            box-shadow:0 2px 6px rgba(0,0,0,0.25);
            border:2px solid white;
          ">🎁 ${offer.campaign.merchant_name}</div>`,
          iconAnchor: [0, 0],
        });

        L.marker([lat, lng], { icon: merchantIcon })
          .addTo(map)
          .on("click", () => onSelectOffer(offer));
      });
    });

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", minHeight: "400px" }}
        aria-label="Bản đồ ưu đãi quanh bạn"
      />
    </>
  );
}
