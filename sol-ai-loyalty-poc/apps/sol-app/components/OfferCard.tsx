"use client";

import { useState } from "react";
import Link from "next/link";
import type { RankedOffer } from "@/types";
import { useExplainOffer } from "@/hooks/useExplainOffer";

const FALLBACK_TEXT =
  "Ưu đãi này phù hợp với hoạt động chi tiêu gần đây của bạn.";

interface OfferCardProps {
  offer: RankedOffer;
  userId: string;
  distance?: number;
  onWhyClick?: (offerId: string) => void;
}

function formatDiscount(type: "percentage" | "fixed", value: number): string {
  if (type === "percentage") return `Giảm ${value}%`;
  return `Giảm ${value.toLocaleString("vi-VN")}đ`;
}

function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`;
}

function formatValidity(end: string): string {
  const date = new Date(end);
  return `HSD: ${date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })}`;
}

export default function OfferCard({ offer, userId, distance, onWhyClick }: OfferCardProps) {
  const { campaign, ai_match_pct } = offer;

  // Each card manages its own tooltip state independently
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  const { explanation, loading, error } = useExplainOffer(userId, activeCampaignId);

  function handleWhyClick() {
    onWhyClick?.(campaign.id);

    if (tooltipOpen) {
      // Toggle off
      setTooltipOpen(false);
      setActiveCampaignId(null);
    } else {
      setTooltipOpen(true);
      setActiveCampaignId(campaign.id);
    }
  }

  function handleClose() {
    setTooltipOpen(false);
    setActiveCampaignId(null);
  }

  const displayText = error || (!loading && !explanation) ? FALLBACK_TEXT : explanation;

  return (
    <article
      className="mx-4 mb-3 p-4 rounded-card bg-white relative"
      style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
      aria-label={`Ưu đãi từ ${campaign.merchant_name}`}
    >
      {/* Header: merchant name + distance (optional) + info icon */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex-1 pr-2">
          <h2
            className="font-bold text-base leading-tight inline-block mr-2"
            style={{ color: "#0046BE" }}
          >
            {campaign.merchant_name}
          </h2>
          {distance !== undefined && (
            <span 
              className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-pill"
              style={{ backgroundColor: "#E8F0FE", color: "#0046BE" }}
            >
              📍 {formatDistance(distance)}
            </span>
          )}
        </div>
        <button
          onClick={handleWhyClick}
          className="text-base leading-none flex-shrink-0 mt-0.5"
          aria-label="Tại sao tôi thấy ưu đãi này?"
          aria-expanded={tooltipOpen}
          title="Tại sao tôi thấy ưu đãi này?"
          style={{
            minWidth: "44px",
            minHeight: "44px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "flex-end",
          }}
        >
          ℹ️
        </button>
      </div>

      {/* AI match score pill */}
      <div className="mb-2">
        <span
          className="inline-block text-xs font-semibold px-2 py-0.5 rounded-pill text-white"
          style={{ backgroundColor: "#00B14F" }}
        >
          {ai_match_pct}% Phù hợp
        </span>
      </div>

      {/* "Why am I seeing this?" tooltip — inline, below match score */}
      {tooltipOpen && (
        <div
          className="mb-3 animate-fadeIn"
          style={{
            backgroundColor: "#F5F7FA",
            border: "1px solid #E0E0E0",
            borderRadius: "8px",
            padding: "10px 12px",
          }}
          role="status"
          aria-live="polite"
          aria-label="Giải thích ưu đãi"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              {loading ? (
                <div className="flex items-center gap-2">
                  {/* Spinner */}
                  <svg
                    className="animate-spin"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="#0046BE"
                      strokeWidth="3"
                      strokeDasharray="31.4"
                      strokeDashoffset="10"
                    />
                  </svg>
                  <span className="text-sm" style={{ color: "#666666" }}>
                    Đang tải giải thích...
                  </span>
                </div>
              ) : (
                <p className="text-sm leading-relaxed" style={{ color: "#1A1A1A" }}>
                  {displayText}
                </p>
              )}
            </div>
            {/* Close button */}
            <button
              onClick={handleClose}
              aria-label="Đóng giải thích"
              className="flex-shrink-0 text-sm font-medium leading-none"
              style={{
                color: "#666666",
                minWidth: "24px",
                minHeight: "24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Promotional copy */}
      <p className="text-sm mb-3 leading-relaxed" style={{ color: "#1A1A1A" }}>
        {campaign.promotional_copy}
      </p>

      {/* Discount value + validity */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <span className="text-sm font-bold" style={{ color: "#FF6B00" }}>
          {formatDiscount(campaign.discount_type, campaign.discount_value)}
        </span>
        <span className="text-xs" style={{ color: "#666666" }}>
          {formatValidity(campaign.validity_end)}
        </span>
      </div>

      {/* Claim button */}
      <Link
        href={`/offers/${campaign.id}`}
        className="block w-full text-center text-white font-semibold text-sm py-2.5 rounded-btn transition-all hover:opacity-90 hover:shadow-btn-hover active:opacity-80"
        style={{ backgroundColor: "#0046BE" }}
      >
        Nhận ưu đãi
      </Link>
    </article>
  );
}
