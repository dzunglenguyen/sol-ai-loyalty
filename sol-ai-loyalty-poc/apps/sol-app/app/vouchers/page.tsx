"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import OfferCard from "@/components/OfferCard";
import OfferCardSkeleton from "@/components/OfferCardSkeleton";
import FallbackBanner from "@/components/FallbackBanner";
import type { RankedOffer, OffersResponse } from "@/types";
import { useProximityNotifier } from "@/hooks/useProximityNotifier";

const MerchantMap = dynamic(() => import("@/components/MerchantMap"), { ssr: false });

const DEMO_USER_ID = "user_001";
const DEFAULT_LAT = 21.041362;
const DEFAULT_LNG = 105.793065;

const CATEGORIES = [
  { id: "beauty", label: "Khỏe Đẹp", icon: "🩺" },
  { id: "electronics", label: "Điện Máy", icon: "🖥️" },
  { id: "food", label: "Ẩm Thực", icon: "🍽️" },
  { id: "fashion", label: "Thời Trang", icon: "👗" },
  { id: "cafe", label: "Cafe Bánh", icon: "☕" },
  { id: "shopping", label: "Mua Sắm", icon: "🛍️" },
  { id: "transport", label: "Di chuyển", icon: "🚗" },
  { id: "other", label: "Dịch vụ khác", icon: "⚙️" },
];

function getCategoryForOffer(offer: RankedOffer): string {
  const name = offer.campaign.merchant_name.toLowerCase();
  if (name.includes("coffee") || name.includes("café") || name.includes("cafe")) return "cafe";
  if (name.includes("food") || name.includes("restaurant") || name.includes("phở")) return "food";
  if (name.includes("fashion") || name.includes("thời trang")) return "fashion";
  if (name.includes("spa") || name.includes("beauty")) return "beauty";
  if (name.includes("điện") || name.includes("tech")) return "electronics";
  if (name.includes("grab") || name.includes("taxi")) return "transport";
  if (name.includes("shop") || name.includes("mart") || name.includes("store")) return "shopping";
  return "other";
}

type MainTab = "for-you" | "nearby";
type NearbyView = "map" | "list";

// Haversine distance in km
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

export default function VouchersPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<RankedOffer[]>([]);
  const [fallback, setFallback] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<MainTab>("for-you");
  const [nearbyView, setNearbyView] = useState<NearbyView>("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [locationGranted, setLocationGranted] = useState(false);
  const [userLat, setUserLat] = useState(DEFAULT_LAT);
  const [userLng, setUserLng] = useState(DEFAULT_LNG);
  const [selectedMapOffer, setSelectedMapOffer] = useState<RankedOffer | null>(null);

  // ── Proximity notification watcher ────────────────────────────────────────
  // Activates after the user grants location on the Nearby tab.
  const { permission: notifPermission, nearbyCount } = useProximityNotifier({
    userId: DEMO_USER_ID,
    radiusKm: 1,
    enabled: locationGranted,
  });

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    fetch(`/api/offers?user_id=${DEMO_USER_ID}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<OffersResponse>;
      })
      .then((data) => {
        const sorted = [...data.offers].sort((a, b) => b.propensity_score - a.propensity_score);
        setOffers(sorted);
        setFallback(data.fallback);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError("Không thể tải ưu đãi. Vui lòng thử lại.");
      })
      .finally(() => { clearTimeout(timeout); setLoading(false); });
    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);

  function handleRequestLocation() {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude);
          setUserLng(pos.coords.longitude);
          setLocationGranted(true);
        },
        () => setLocationGranted(true)
      );
    } else {
      setLocationGranted(true);
    }
  }

  const handleMapOfferSelect = useCallback((offer: RankedOffer) => {
    setSelectedMapOffer(offer);
  }, []);

  // For-you list: offers filtered by search/category, plus calculated distance
  const filteredOffersWithDistance = useMemo(() => {
    let list = offers;
    if (selectedCategory) list = list.filter((o) => getCategoryForOffer(o) === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (o) =>
          o.campaign.merchant_name.toLowerCase().includes(q) ||
          o.campaign.promotional_copy.toLowerCase().includes(q)
      );
    }

    return list
      .map((o) => ({
        offer: o,
        distance: (o.campaign.merchant_lat != null && o.campaign.merchant_lng != null)
          ? distanceKm(userLat, userLng, o.campaign.merchant_lat, o.campaign.merchant_lng)
          : null,
      }))
      .sort((a, b) => b.offer.propensity_score - a.offer.propensity_score);
  }, [offers, selectedCategory, searchQuery, userLat, userLng]);

  // Nearby list: offers with coords within 1km, sorted by distance
  const nearbyOffers = useMemo(() => {
    return offers
      .filter((o) => o.campaign.merchant_lat != null && o.campaign.merchant_lng != null)
      .map((o) => ({
        offer: o,
        distance: distanceKm(userLat, userLng, o.campaign.merchant_lat!, o.campaign.merchant_lng!),
      }))
      .filter((o) => o.distance <= 1)
      .sort((a, b) => a.distance - b.distance);
  }, [offers, userLat, userLng]);

  return (
    <>
      <TopNav title="Ưu đãi" showBack backHref="/" />
      <main className="flex-1 overflow-hidden flex flex-col" style={{ backgroundColor: "#F5F7FA" }}>

        {/* Search bar — only show on for-you tab */}
        {mainTab === "for-you" && (
          <div className="px-4 pt-3 pb-2 bg-white">
            <div className="flex items-center gap-2 px-3 py-2 rounded-full"
              style={{ backgroundColor: "#F5F7FA", border: "1px solid #E0E7FF" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="#666666" strokeWidth="2" />
                <path d="M16.5 16.5L21 21" stroke="#666666" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                placeholder="Bạn muốn tìm voucher nào?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm outline-none"
                style={{ color: "#1A1A1A" }}
                aria-label="Tìm kiếm voucher"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} aria-label="Xóa" className="text-gray-400 text-sm">✕</button>
              )}
            </div>
          </div>
        )}

        {/* Main tabs */}
        <div className="flex bg-white flex-shrink-0" style={{ borderBottom: "1px solid #E0E0E0" }}>
          {(["for-you", "nearby"] as MainTab[]).map((tab) => {
            const label = tab === "for-you" ? "Dành cho bạn" : "Ưu đãi quanh tôi";
            const active = mainTab === tab;
            return (
              <button
                key={tab}
                onClick={() => {
                  setMainTab(tab);
                  setSelectedMapOffer(null);
                  if (tab === "nearby" && !locationGranted) handleRequestLocation();
                }}
                className="flex-1 py-3 text-sm font-semibold relative transition-colors"
                style={{ color: active ? "#0046BE" : "#666666" }}
                aria-selected={active}
              >
                {label}
                {active && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full"
                    style={{ backgroundColor: "#0046BE" }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Category chips — only on for-you tab */}
        {mainTab === "for-you" && (
          <div className="bg-white pt-3 pb-3 px-4 flex-shrink-0" style={{ borderBottom: "1px solid #F0F0F0" }}>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(active ? null : cat.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-pill text-xs font-medium transition-all hover:shadow-sm"
                    style={{
                      backgroundColor: active ? "#0046BE" : "#F5F7FA",
                      color: active ? "#FFFFFF" : "#1A1A1A",
                      border: `1px solid ${active ? "#0046BE" : "#E0E0E0"}`,
                    }}
                    aria-pressed={active}
                  >
                    <span aria-hidden="true">{cat.icon}</span>
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* FOR YOU tab content */}
        {mainTab === "for-you" && (
          <div className="flex-1 overflow-y-auto pt-3 pb-2">
            {fallback && <FallbackBanner />}
            {loading && <><OfferCardSkeleton /><OfferCardSkeleton /><OfferCardSkeleton /></>}
            {!loading && error && (
              <div className="mx-4 mt-6 text-center" style={{ color: "#666666" }}>
                <p className="text-2xl mb-2">😕</p>
                <p className="text-sm">{error}</p>
                <button onClick={() => window.location.reload()}
                  className="mt-4 px-6 py-2 text-sm font-semibold text-white rounded-btn"
                  style={{ backgroundColor: "#0046BE" }}>Thử lại</button>
              </div>
            )}
            {!loading && !error && filteredOffersWithDistance.length === 0 && (
              <div className="mx-4 mt-6 text-center" style={{ color: "#666666" }}>
                <p className="text-2xl mb-2">🎁</p>
                <p className="text-sm">{searchQuery || selectedCategory ? "Không tìm thấy ưu đãi phù hợp." : "Chưa có ưu đãi nào."}</p>
                {(searchQuery || selectedCategory) && (
                  <button onClick={() => { setSearchQuery(""); setSelectedCategory(null); }}
                    className="mt-3 text-sm font-medium" style={{ color: "#0046BE" }}>Xóa bộ lọc</button>
                )}
              </div>
            )}
            {!loading && !error && filteredOffersWithDistance.map(({ offer, distance }) => (
              <OfferCard
                key={offer.campaign.id}
                offer={offer}
                userId={DEMO_USER_ID}
                distance={distance ?? undefined}
              />
            ))}
          </div>
        )}

        {/* NEARBY tab content — map or list */}
        {mainTab === "nearby" && (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Proximity alert status pill */}
            {locationGranted && notifPermission === "granted" && (
              <div
                className="flex-shrink-0 flex items-center justify-center gap-2 py-2 px-4"
                style={{ backgroundColor: "#F0FFF4", borderBottom: "1px solid #BBF7D0" }}
              >
                {/* Pulsing green dot */}
                <span className="relative flex h-2.5 w-2.5">
                  <span
                    className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                    style={{ backgroundColor: "#00B14F" }}
                  />
                  <span
                    className="relative inline-flex rounded-full h-2.5 w-2.5"
                    style={{ backgroundColor: "#00B14F" }}
                  />
                </span>
                <span className="text-xs font-semibold" style={{ color: "#00B14F" }}>
                  Cảnh báo ưu đãi đang hoạt động
                  {nearbyCount > 0 && ` · ${nearbyCount} merchant trong 1km`}
                </span>
              </div>
            )}

            {/* Notification permission denied warning */}
            {locationGranted && notifPermission === "denied" && (
              <div
                className="flex-shrink-0 flex items-center gap-2 py-2 px-4"
                style={{ backgroundColor: "#FFF7ED", borderBottom: "1px solid #FED7AA" }}
              >
                <span className="text-sm">⚠️</span>
                <span className="text-xs" style={{ color: "#92400E" }}>
                  Thông báo bị chặn. Bật lại trong Cài đặt trình duyệt để nhận ưu đãi tự động.
                </span>
              </div>
            )}
            {!locationGranted ? (
              <div className="flex-1 flex items-center justify-center px-4">
                <div className="bg-white rounded-card p-6 text-center w-full"
                  style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
                  <p className="text-4xl mb-3">📍</p>
                  <p className="font-semibold mb-1" style={{ color: "#1A1A1A" }}>Xem ưu đãi quanh bạn</p>
                  <p className="text-sm mb-4" style={{ color: "#666666" }}>
                    Cho phép truy cập vị trí để hiển thị các merchant đang có ưu đãi gần bạn
                  </p>
                  <button onClick={handleRequestLocation}
                    className="w-full py-3 text-sm font-bold text-white rounded-btn transition-all hover:opacity-90 hover:shadow-btn-hover"
                    style={{ backgroundColor: "#0046BE" }}>
                    Cho phép truy cập vị trí
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Map / List toggle */}
                <div className="flex-shrink-0 bg-white px-4 py-2 flex items-center justify-end gap-1"
                  style={{ borderBottom: "1px solid #E0E0E0" }}>
                  <button
                    onClick={() => setNearbyView("list")}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-l-pill text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: nearbyView === "list" ? "#0046BE" : "#F5F7FA",
                      color: nearbyView === "list" ? "#FFFFFF" : "#666666",
                      border: "1px solid #E0E0E0",
                      borderRight: "none",
                    }}
                    aria-pressed={nearbyView === "list"}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    Danh sách
                  </button>
                  <button
                    onClick={() => { setNearbyView("map"); setSelectedMapOffer(null); }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-r-pill text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: nearbyView === "map" ? "#0046BE" : "#F5F7FA",
                      color: nearbyView === "map" ? "#FFFFFF" : "#666666",
                      border: "1px solid #E0E0E0",
                      borderLeft: "none",
                    }}
                    aria-pressed={nearbyView === "map"}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Bản đồ
                  </button>
                </div>

                {/* LIST VIEW */}
                {nearbyView === "list" && (
                  <div className="flex-1 overflow-y-auto pt-3 pb-2">
                    {loading && <><OfferCardSkeleton /><OfferCardSkeleton /><OfferCardSkeleton /></>}
                    {!loading && nearbyOffers.length === 0 && (
                      <div className="mx-4 mt-6 text-center" style={{ color: "#666666" }}>
                        <p className="text-2xl mb-2">📍</p>
                        <p className="text-sm">Không có merchant nào có tọa độ gần bạn.</p>
                      </div>
                    )}
                    {!loading && nearbyOffers.map(({ offer, distance }) => (
                      <div
                        key={offer.campaign.id}
                        className="mx-4 mb-3 p-4 rounded-card bg-white"
                        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <h3 className="font-bold text-base leading-tight flex-1 pr-2"
                            style={{ color: "#0046BE" }}>
                            {offer.campaign.merchant_name}
                          </h3>
                          {/* Distance badge */}
                          <span className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-pill"
                            style={{ backgroundColor: "#E8F0FE", color: "#0046BE" }}>
                            📍 {formatDistance(distance)}
                          </span>
                        </div>
                        <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-pill text-white mb-2"
                          style={{ backgroundColor: "#00B14F" }}>
                          {offer.ai_match_pct}% Phù hợp
                        </span>
                        <p className="text-sm mb-3 leading-relaxed" style={{ color: "#1A1A1A" }}>
                          {offer.campaign.promotional_copy}
                        </p>
                        <button
                          onClick={() => router.push(`/offers/${offer.campaign.id}`)}
                          className="w-full py-2.5 text-sm font-bold text-white rounded-btn transition-all hover:opacity-90 hover:shadow-btn-hover"
                          style={{ backgroundColor: "#0046BE" }}>
                          Xem chi tiết & Nhận ưu đãi
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* MAP VIEW */}
                {nearbyView === "map" && (
                  <>
                    <div className="flex-1 relative" style={{ minHeight: 0 }}>
                      {loading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                          <p className="text-sm" style={{ color: "#666666" }}>Đang tải bản đồ...</p>
                        </div>
                      ) : (
                        <MerchantMap
                          offers={offers}
                          userLat={userLat}
                          userLng={userLng}
                          onSelectOffer={handleMapOfferSelect}
                        />
                      )}
                    </div>

                    {/* Bottom sheet: selected offer or hint */}
                    <div className="flex-shrink-0 bg-white" style={{ borderTop: "1px solid #E0E0E0" }}>
                      {selectedMapOffer ? (
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <h3 className="font-bold text-base inline-block mr-2" style={{ color: "#0046BE" }}>
                                {selectedMapOffer.campaign.merchant_name}
                              </h3>
                              {selectedMapOffer.campaign.merchant_lat != null && selectedMapOffer.campaign.merchant_lng != null && (
                                <span
                                  className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-pill"
                                  style={{ backgroundColor: "#E8F0FE", color: "#0046BE" }}
                                >
                                  📍 {formatDistance(distanceKm(userLat, userLng, selectedMapOffer.campaign.merchant_lat, selectedMapOffer.campaign.merchant_lng))}
                                </span>
                              )}
                            </div>
                            <button onClick={() => setSelectedMapOffer(null)}
                              className="text-gray-400 text-lg leading-none ml-2">✕</button>
                          </div>
                          <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-pill text-white mb-2"
                            style={{ backgroundColor: "#00B14F" }}>
                            {selectedMapOffer.ai_match_pct}% Phù hợp
                          </span>
                          <p className="text-sm mb-3 leading-relaxed" style={{ color: "#1A1A1A" }}>
                            {selectedMapOffer.campaign.promotional_copy}
                          </p>
                          <button
                            onClick={() => router.push(`/offers/${selectedMapOffer.campaign.id}`)}
                            className="w-full py-2.5 text-sm font-bold text-white rounded-btn transition-all hover:opacity-90 hover:shadow-btn-hover"
                            style={{ backgroundColor: "#0046BE" }}>
                            Xem chi tiết & Nhận ưu đãi
                          </button>
                        </div>
                      ) : (
                        <div className="px-4 py-3 flex items-center gap-2">
                          <span className="text-lg">🎁</span>
                          <p className="text-sm" style={{ color: "#666666" }}>
                            Nhấn vào nhãn merchant trên bản đồ để xem ưu đãi
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </>
  );
}
