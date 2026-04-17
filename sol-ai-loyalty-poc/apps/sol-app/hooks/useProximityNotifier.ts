"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Notification permission state readable by the parent component.
 */
export type NotifPermission = "default" | "granted" | "denied" | "unsupported";

interface UseProximityNotifierOptions {
  userId: string;
  /** Radius in km — defaults to 1 */
  radiusKm?: number;
  /** Poll interval in ms when geolocation watchPosition is unavailable — defaults to 30 000 */
  pollIntervalMs?: number;
  /** Set to false to completely disable the watcher */
  enabled?: boolean;
}

/**
 * useProximityNotifier
 *
 * Watches the user's GPS position via `navigator.geolocation.watchPosition`.
 * When the device enters a 1 km radius of a participating merchant, shows an
 * OS-level push notification via the registered Service Worker.
 *
 * De-duplication: each campaign_id fires at most once per "visit". The notified
 * set clears if ALL previously-notified merchants are no longer within range,
 * preventing infinite re-notification while inside a zone *and* letting the
 * alert fire again on a fresh visit.
 */
export function useProximityNotifier({
  userId,
  radiusKm = 1,
  enabled = true,
}: UseProximityNotifierOptions) {
  const [permission, setPermission] = useState<NotifPermission>("default");
  const [nearbyCount, setNearbyCount] = useState(0);

  // Tracks campaign IDs that have already triggered a notification this session.
  const notifiedIds = useRef<Set<string>>(new Set());

  // ── Request notification permission on mount ─────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as NotifPermission);

    if (Notification.permission === "default") {
      Notification.requestPermission().then((perm) => {
        setPermission(perm as NotifPermission);
      });
    }
  }, [enabled]);

  // ── Geolocation watch + proximity check ──────────────────────────────────
  useEffect(() => {
    if (!enabled) return;
    if (typeof navigator === "undefined") return;
    if (!navigator.geolocation) return;

    let watchId: number;

    async function checkProximity(lat: number, lng: number) {
      try {
        const res = await fetch(
          `/api/nearby-offers?user_id=${encodeURIComponent(userId)}&lat=${lat}&lng=${lng}&radius_km=${radiusKm}`
        );
        if (!res.ok) return;

        const data = await res.json() as {
          nearby_offers: Array<{ campaign: { id: string; merchant_name: string; promotional_copy: string; discount_type: string; discount_value: number; validity_end: string } }>;
        };

        const offers = data.nearby_offers ?? [];
        const currentInRange = new Set<string>(offers.map((o) => o.campaign.id));

        // Clear notified set only when we've entirely left the vicinity of all
        // previously-notified merchants. This implements "per-visit" alerts.
        const stillInRange = Array.from(notifiedIds.current).some((id) =>
          currentInRange.has(id)
        );
        if (!stillInRange) {
          notifiedIds.current.clear();
        }

        setNearbyCount(currentInRange.size);

        // Fire notifications for newly in-range merchants
        for (const offer of offers) {
          const { id, merchant_name, promotional_copy, discount_type, discount_value, validity_end } = offer.campaign;

          if (notifiedIds.current.has(id)) continue; // already notified this visit
          if (Notification.permission !== "granted") continue;

          notifiedIds.current.add(id);

          // Build concise body
          const discount =
            discount_type === "percentage"
              ? `Giảm ${discount_value}%`
              : `Giảm ${discount_value.toLocaleString("vi-VN")}đ`;
          const expiry = new Date(validity_end).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
          });
          const body = `${discount} · HSD ${expiry}\n${promotional_copy.slice(0, 90)}${promotional_copy.length > 90 ? "…" : ""}`;

          // Use Service Worker registration to show the notification so it
          // works even when the page is in the background.
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification(`🎁 Ưu đãi gần bạn — ${merchant_name}`, {
              body,
              icon: "/icons/icon-192.svg",
              badge: "/icons/icon-192.svg",
              tag: `sol-proximity-${id}`,          // dedupes at OS level too
              renotify: false,
              data: { url: `/offers/${id}` },
            } as NotificationOptions);
          } else {
            // Fallback: in-page Notification API
            new Notification(`🎁 Ưu đãi gần bạn — ${merchant_name}`, { body });
          }
        }
      } catch {
        // silently ignore network errors — proximity is best-effort
      }
    }

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        console.log(`[useProximityNotifier] location update: ${pos.coords.latitude}, ${pos.coords.longitude}`);
        checkProximity(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn("[useProximityNotifier] geolocation error:", err.code, err.message);
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 5000, 
        timeout: 10000 
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [userId, radiusKm, enabled]);

  return { permission, nearbyCount };
}
