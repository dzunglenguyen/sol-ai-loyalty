"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getMerchantProfile, upsertMerchantProfile } from "@/lib/supabase/merchantProfileRepo";
import { getCurrentMerchantKey } from "@/lib/supabase/client";
import { FADE_UP } from "@/components/merchant-campaign/animations";
import type { MerchantProfileRow } from "@/lib/supabase/tables";

type Phase = "loading" | "form" | "profile";

export function OnboardingFlow({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfileRow | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [sector, setSector] = useState("");
  const [addressText, setAddressText] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      const profile = await getMerchantProfile();
      if (!mounted) return;
      setMerchantProfile(profile);
      setBusinessName(profile?.business_name ?? "");
      setSector(profile?.sector ?? "");
      setAddressText(profile?.address_text ?? "");
      setMapsUrl(profile?.maps_url ?? "");
      setLat(profile?.latitude ?? null);
      setLng(profile?.longitude ?? null);
      if (profile?.business_name?.trim()) {
        setPhase("profile");
        return;
      }
      setPhase("form");
    };
    void boot();
    return () => {
      mounted = false;
    };
  }, []);

  const hasCoordinates = useMemo(() => lat != null && lng != null, [lat, lng]);

  const handleDetectLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Trình duyệt không hỗ trợ định vị.");
      return;
    }
    setError(null);
    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = Number(position.coords.latitude.toFixed(6));
        const nextLng = Number(position.coords.longitude.toFixed(6));
        setLat(nextLat);
        setLng(nextLng);
        setMapsUrl(`https://maps.google.com/?q=${nextLat},${nextLng}`);
        setIsGettingLocation(false);
      },
      () => {
        setError("Không thể lấy vị trí hiện tại. Bạn có thể dán link Google Maps thủ công.");
        setIsGettingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!businessName.trim()) {
      setError("Vui lòng nhập tên cửa hàng.");
      return;
    }
    setIsSaving(true);
    try {
      const merchantKey = await getCurrentMerchantKey();
      if (!merchantKey) {
        setError("Chưa xác thực được tài khoản. Vui lòng tải lại trang và thử lại.");
        setIsSaving(false);
        return;
      }
      const row = await upsertMerchantProfile({
        external_key: merchantKey,
        business_name: businessName.trim(),
        sector: sector.trim() || null,
        address_text: addressText.trim() || null,
        maps_url: mapsUrl.trim() || null,
        latitude: lat,
        longitude: lng,
        aov_vnd: merchantProfile?.aov_vnd ?? null,
        peak_hours: merchantProfile?.peak_hours ?? null,
        customer_segment: merchantProfile?.customer_segment ?? null,
        ai_notes: merchantProfile?.ai_notes ?? null,
      });
      if (!row) {
        setError("Không thể lưu hồ sơ cửa hàng. Vui lòng thử lại.");
        setIsSaving(false);
        return;
      }
      setMerchantProfile(row);
      setPhase("profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (phase === "loading") {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6 bg-white">
        <div className="flex flex-col items-center gap-3">
          <span
            className="inline-flex h-10 w-10 rounded-full border-2 border-shinhan-navy/20 border-t-shinhan-navy animate-spin"
            aria-hidden
          />
          <p className="text-[13px] text-text-secondary">Đang tải hồ sơ cửa hàng...</p>
        </div>
      </div>
    );
  }

  if (phase === "form") {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-10 bg-surface-secondary/80">
        <motion.div
          variants={FADE_UP}
          initial="hidden"
          animate="visible"
          className="max-w-[620px] w-full bg-white rounded-2xl border border-border-primary/60 shadow-[0_8px_40px_-12px_rgba(0,57,127,0.12)] p-6 md:p-8"
          style={{ willChange: "transform, opacity" }}
        >
          <Image
            src="/shinhan-logo.svg"
            alt="Shinhan Bank"
            width={130}
            height={22}
            className="h-5 w-auto mb-5"
            priority
          />
          <h1 className="text-[22px] md:text-[24px] font-semibold text-text-primary tracking-[-0.03em] leading-tight">
            Đăng ký thông tin cửa hàng
          </h1>
          <p className="text-[13px] text-text-secondary mt-2 mb-6 leading-relaxed">
            Hoàn tất hồ sơ để AI cá nhân hóa chiến dịch theo địa điểm thực tế của cửa hàng.
          </p>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="text-[12px] font-medium text-text-primary block mb-1.5">
                Tên cửa hàng <span className="text-status-warning">*</span>
              </label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="VD: Cà phê Mộc Quận 1"
                className="w-full h-10 px-3 rounded-lg border border-border-primary bg-white text-[13px] outline-none focus:ring-2 focus:ring-shinhan-navy/20"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-text-primary block mb-1.5">Ngành hàng</label>
              <input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="VD: F&B"
                className="w-full h-10 px-3 rounded-lg border border-border-primary bg-white text-[13px] outline-none focus:ring-2 focus:ring-shinhan-navy/20"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-text-primary block mb-1.5">Địa chỉ cửa hàng</label>
              <input
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                placeholder="VD: 72 Lê Thánh Tôn, Quận 1, TP.HCM"
                className="w-full h-10 px-3 rounded-lg border border-border-primary bg-white text-[13px] outline-none focus:ring-2 focus:ring-shinhan-navy/20"
              />
            </div>

            <div>
              <label className="text-[12px] font-medium text-text-primary block mb-1.5">
                Link Google Maps
              </label>
              <input
                value={mapsUrl}
                onChange={(e) => setMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="w-full h-10 px-3 rounded-lg border border-border-primary bg-white text-[13px] outline-none focus:ring-2 focus:ring-shinhan-navy/20"
              />
            </div>

            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={isGettingLocation}
              className="w-full h-10 rounded-lg border border-shinhan-navy/20 text-[12px] font-medium text-shinhan-navy hover:bg-shinhan-blue-light/60 disabled:opacity-50"
            >
              {isGettingLocation ? "Đang lấy vị trí..." : "Lấy vị trí hiện tại"}
            </button>

            {hasCoordinates && (
              <p className="text-[12px] text-text-secondary">
                Tọa độ hiện tại: {lat}, {lng}
              </p>
            )}

            {error && <p className="text-[12px] text-status-warning">{error}</p>}

            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={isSaving}
              className="w-full py-3 rounded-xl text-[13px] font-semibold text-white bg-shinhan-navy
                hover:bg-shinhan-navy/92 transition-colors disabled:opacity-70"
            >
              {isSaving ? "Đang lưu..." : "Lưu và tiếp tục"}
            </motion.button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-5 py-10 bg-surface-secondary/80">
      <motion.div
        variants={FADE_UP}
        initial="hidden"
        animate="visible"
        className="max-w-[520px] w-full bg-white rounded-2xl border border-border-primary/60 shadow-[0_8px_40px_-12px_rgba(0,57,127,0.12)] p-6 md:p-8"
        style={{ willChange: "transform, opacity" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-shinhan-blue-light flex items-center justify-center text-[13px] font-bold text-shinhan-navy">
            AI
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
              Hồ sơ đã lưu
            </p>
            <h2 className="text-[18px] font-semibold text-text-primary tracking-[-0.02em]">
              {merchantProfile?.business_name || businessName}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          <ProfilePill label="Ngành hàng" value={merchantProfile?.sector || "Chưa cập nhật"} />
          <ProfilePill label="Địa chỉ" value={merchantProfile?.address_text || "Chưa cập nhật"} />
          <ProfilePill label="Google Maps" value={merchantProfile?.maps_url || "Chưa cập nhật"} />
          <ProfilePill
            label="Tọa độ"
            value={
              merchantProfile?.latitude != null && merchantProfile?.longitude != null
                ? `${merchantProfile.latitude}, ${merchantProfile.longitude}`
                : "Chưa cập nhật"
            }
          />
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={onComplete}
          className="w-full py-3 rounded-xl text-[13px] font-semibold text-white bg-shinhan-navy
            hover:bg-shinhan-navy/92 transition-colors"
        >
          Vào trang chiến dịch
        </motion.button>
      </motion.div>
    </div>
  );
}

function ProfilePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-primary/50 bg-surface-secondary/50 px-3.5 py-3">
      <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-[0.06em] mb-1">
        {label}
      </p>
      <p className="text-[13px] font-medium text-text-primary leading-snug">{value}</p>
    </div>
  );
}
