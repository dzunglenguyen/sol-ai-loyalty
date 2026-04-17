"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import type { RankedOffer, OffersResponse } from "@/types";

const DEMO_USER_ID = "user_001";
const DEMO_MERCHANT_ID = "merch_001";
const QR_TTL = 60;

function formatDiscount(type: "percentage" | "fixed", value: number): string {
  if (type === "percentage") return `Giảm ${value}%`;
  return `Giảm ${value.toLocaleString("vi-VN")}đ`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export default function OfferDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [offer, setOffer] = useState<RankedOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // QR state
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [expired, setExpired] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/offers?user_id=${DEMO_USER_ID}`)
      .then((res) => res.json() as Promise<OffersResponse>)
      .then((data) => {
        const found = data.offers.find((o) => o.campaign.id === id) ?? null;
        setOffer(found);
      })
      .catch(() => setError("Không thể tải thông tin ưu đãi."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startCountdown() {
    setCountdown(QR_TTL);
    setExpired(false);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setExpired(true);
          setQrImage(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }

  async function handleClaimPay() {
    if (!offer) return;
    setQrLoading(true);
    setQrError(null);
    setQrImage(null);
    setExpired(false);

    try {
      const res = await fetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: DEMO_USER_ID,
          merchantId: DEMO_MERCHANT_ID,
          campaignId: offer.campaign.id,
          paymentAmount: 0, // amount unknown until merchant scans
          voucherCode: `VOUCHER-${offer.campaign.id.toUpperCase()}`,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setQrImage(data.qrImageBase64);
      startCountdown();
    } catch {
      setQrError("Không thể tạo mã QR. Vui lòng thử lại.");
    } finally {
      setQrLoading(false);
    }
  }

  return (
    <>
      <TopNav title="Chi tiết ưu đãi" showBack backHref="/vouchers" />

      <main className="flex-1 overflow-y-auto pt-4 pb-4 px-4" style={{ backgroundColor: "#F5F7FA" }}>
        {loading && (
          <div className="animate-pulse space-y-3">
            <div className="h-6 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-40 bg-gray-200 rounded-card" />
          </div>
        )}

        {!loading && error && (
          <p className="text-center text-sm mt-8" style={{ color: "#666666" }}>{error}</p>
        )}

        {!loading && !error && !offer && (
          <p className="text-center text-sm mt-8" style={{ color: "#666666" }}>Không tìm thấy ưu đãi.</p>
        )}

        {!loading && !error && offer && (
          <div className="bg-white rounded-card p-4" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
            {/* Merchant name */}
            <h2 className="font-bold text-xl mb-1" style={{ color: "#0046BE" }}>
              {offer.campaign.merchant_name}
            </h2>

            {/* AI match pill */}
            <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-pill text-white mb-3"
              style={{ backgroundColor: "#00B14F" }}>
              {offer.ai_match_pct}% Phù hợp
            </span>

            {/* Promo copy */}
            <p className="text-sm leading-relaxed mb-4" style={{ color: "#1A1A1A" }}>
              {offer.campaign.promotional_copy}
            </p>

            {/* Offer details — no payment amounts */}
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span style={{ color: "#666666" }}>Ưu đãi</span>
                <span className="font-semibold" style={{ color: "#FF6B00" }}>
                  {formatDiscount(offer.campaign.discount_type, offer.campaign.discount_value)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "#666666" }}>Hiệu lực từ</span>
                <span style={{ color: "#1A1A1A" }}>{formatDate(offer.campaign.validity_start)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "#666666" }}>Hết hạn</span>
                <span style={{ color: "#1A1A1A" }}>{formatDate(offer.campaign.validity_end)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: "#666666" }}>Đã dùng</span>
                <span style={{ color: "#1A1A1A" }}>
                  {offer.campaign.redemption_count} / {offer.campaign.max_redemption_count}
                </span>
              </div>
            </div>

            {/* QR display */}
            {qrImage && !expired && (
              <div className="flex flex-col items-center mb-4 p-4 rounded-xl"
                style={{ backgroundColor: "#F5F7FA", border: "1px solid #E0E0E0" }}>
                <p className="text-xs font-medium mb-3" style={{ color: "#666666" }}>
                  Cho merchant quét mã này để áp dụng ưu đãi
                </p>
                <Image src={qrImage} alt="Dynamic QR Code" width={200} height={200} className="rounded-xl" />
                <div className="mt-3 text-sm font-semibold"
                  style={{ color: countdown <= 10 ? "#FF6B00" : "#0046BE" }}>
                  Mã hết hạn sau {countdown}s
                </div>
              </div>
            )}

            {expired && (
              <div className="text-center mb-4 p-3 rounded-xl text-sm font-medium"
                style={{ backgroundColor: "#FFF3E0", color: "#FF6B00" }}>
                Mã QR đã hết hạn. Nhấn bên dưới để tạo lại.
              </div>
            )}

            {qrError && (
              <div className="text-center mb-4 text-sm" style={{ color: "#FF6B00" }}>{qrError}</div>
            )}

            <div className="flex flex-col gap-3">
              <button
                className="w-full text-center text-white font-bold text-base py-3 rounded-btn transition-all hover:opacity-90 hover:shadow-btn-hover active:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "#0046BE" }}
                onClick={handleClaimPay}
                disabled={qrLoading}
              >
                {qrLoading
                  ? "Đang tạo mã..."
                  : expired
                  ? "Tạo lại mã QR"
                  : qrImage
                  ? "Tạo mã mới"
                  : "Nhận & Thanh toán"}
              </button>

              <button
                className="w-full text-center font-bold text-base py-3 rounded-btn border-2 transition-all hover:bg-gray-50 active:bg-gray-100"
                style={{ borderColor: "#0046BE", color: "#0046BE" }}
                onClick={() => router.push("/qr")}
              >
                🔍 Quét mã QR thanh toán
              </button>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </>
  );
}
