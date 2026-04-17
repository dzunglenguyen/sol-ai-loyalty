"use client";

import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotReadable } from "@copilotkit/react-core";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Power, Trash2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OnboardingFlow } from "@/components/merchant-campaign/OnboardingFlow";
import { FADE_UP, SPRING } from "@/components/merchant-campaign/animations";
import { CampaignDashboard } from "@/components/merchant-campaign/CampaignDashboard";
import { CampaignForm } from "@/components/merchant-campaign/CampaignForm";
import { copilotKitThemeVars } from "@/lib/brand";
import { copilotProactiveGreeting } from "@/lib/demoMerchant";
import { siteCopy } from "@/lib/siteCopy";
import { SmoothAssistantMessage } from "@/components/SmoothAssistantMessage";
import { useCampaignCopilot } from "@/hooks/useCampaignCopilot";
import { INITIAL_DRAFT } from "@/lib/merchant-campaign/constants";
import type { CampaignDraft, CampaignStatus, DiscountConfig } from "@/lib/merchant-campaign/types";
import type { CampaignRow, MerchantProfileRow } from "@/lib/supabase/tables";
import {
  deleteCampaign,
  listCampaigns,
  setCampaignActive,
  upsertCampaignFromDraft,
} from "@/lib/supabase/campaignsRepo";
import {
  calculateEstimation,
  formatForecastDigest,
  getCampaignForecastDetails,
} from "@/utils/estimationEngine";
import {
  listDocuments,
  buildKnowledgeDigest,
} from "@/lib/supabase/knowledgeBaseRepo";
import { getMerchantProfile } from "@/lib/supabase/merchantProfileRepo";
import { getCampaignRevenueStats, type CampaignRevenueStats } from "@/lib/supabase/ordersRepo";

export default function MerchantCampaignPage() {
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>(INITIAL_DRAFT);
  const [flashFields, setFlashFields] = useState<Set<string>>(new Set());
  const [persistedCampaignId, setPersistedCampaignId] = useState<string | null>(null);
  const persistedIdRef = useRef<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
  const [knowledgeDigest, setKnowledgeDigest] = useState("");
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfileRow | null>(null);
  const [campaignRevenueStats, setCampaignRevenueStats] = useState<CampaignRevenueStats | null>(null);

  useEffect(() => {
    persistedIdRef.current = persistedCampaignId;
  }, [persistedCampaignId]);

  useEffect(() => {
    listDocuments().then((docs) => {
      setKnowledgeDigest(buildKnowledgeDigest(docs));
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      setIsProfileLoading(true);
      const row = await getMerchantProfile();
      if (!mounted) return;
      setMerchantProfile(row);
      setNeedsOnboarding(!row?.business_name?.trim());
      setIsProfileLoading(false);
    };
    void loadProfile();
    return () => {
      mounted = false;
    };
  }, []);

  useCopilotReadable({
    description: `Kho tri thức cửa hàng (Store Knowledge Base). AI PHẢI sử dụng thông tin này khi tư vấn chiến dịch.
Nếu có menu: ưu tiên đề xuất dựa trên giá và danh mục món thực tế.
Nếu có mô tả không gian: gợi ý chiến dịch phù hợp vị trí.
Nếu có brand voice: tuân thủ phong cách và chính sách khi soạn nội dung.`,
    value: knowledgeDigest || "(Chưa có tài liệu nào trong Knowledge Base)",
  });

  const finishOnboarding = useCallback(() => {
    setNeedsOnboarding(false);
    getMerchantProfile().then((row) => setMerchantProfile(row));
  }, []);

  const triggerFlash = useCallback((fieldNames: string[]) => {
    setFlashFields(new Set(fieldNames));
    setTimeout(() => setFlashFields(new Set()), 900);
  }, []);

  const forecastDetails = useMemo(
    () => getCampaignForecastDetails(campaignDraft.budget, campaignDraft.discount),
    [campaignDraft.budget, campaignDraft.discount],
  );
  const estimation = forecastDetails?.estimation ?? null;
  const forecastDigest = forecastDetails ? formatForecastDigest(forecastDetails) : null;

  const persistToSupabase = useCallback(async (next: CampaignDraft) => {
    const row = await upsertCampaignFromDraft(next, persistedIdRef.current);
    if (row) {
      persistedIdRef.current = row.id;
      setPersistedCampaignId(row.id);
      void reloadCampaigns();
    }
  }, []);

  const reloadCampaigns = useCallback(async () => {
    setIsLoadingCampaigns(true);
    const rows = await listCampaigns();
    setCampaigns(rows);
    setIsLoadingCampaigns(false);
  }, []);

  const clearPersistedCampaign = useCallback(() => {
    persistedIdRef.current = null;
    setPersistedCampaignId(null);
  }, []);

  const handleOpenCampaign = useCallback((row: CampaignRow) => {
    setCampaignDraft(row.draft);
    persistedIdRef.current = row.id;
    setPersistedCampaignId(row.id);
  }, []);

  const handleToggleCampaign = useCallback(async (row: CampaignRow) => {
    await setCampaignActive(row.id, !row.is_active);
    await reloadCampaigns();
  }, [reloadCampaigns]);

  const handleDeleteCampaign = useCallback(async (id: string) => {
    await deleteCampaign(id);
    if (persistedIdRef.current === id) {
      setCampaignDraft(INITIAL_DRAFT);
      clearPersistedCampaign();
    }
    await reloadCampaigns();
  }, [clearPersistedCampaign, reloadCampaigns]);

  useCampaignCopilot({
    draft: campaignDraft,
    setDraft: setCampaignDraft,
    estimation,
    forecastDigest,
    triggerFlash,
    onPublished: persistToSupabase,
    onResetCampaign: clearPersistedCampaign,
    merchantProfile,
  });

  const handlePublish = async () => {
    const next: CampaignDraft = {
      ...campaignDraft,
      status: "published",
      estimation: calculateEstimation(campaignDraft.budget, campaignDraft.discount),
    };
    setCampaignDraft(next);
    await persistToSupabase(next);
  };

  const handleReset = () => {
    setCampaignDraft(INITIAL_DRAFT);
    clearPersistedCampaign();
  };

  const handleFieldChange = (field: keyof CampaignDraft, value: string | number) => {
    setCampaignDraft((prev) => ({
      ...prev,
      [field]: value,
      status: "drafting",
    }));
  };

  const handleDiscountChange = (
    field: keyof DiscountConfig,
    value: string | number,
  ) => {
    setCampaignDraft((prev) => ({
      ...prev,
      discount: { ...prev.discount, [field]: value },
      status: "drafting",
    }));
  };

  const isDraftReady =
    campaignDraft.title.trim() !== "" &&
    campaignDraft.targetAudience.trim() !== "" &&
    campaignDraft.discount.value > 0 &&
    campaignDraft.discount.totalCodes > 0 &&
    campaignDraft.budget > 0;

  useEffect(() => {
    if (isProfileLoading || needsOnboarding) return;
    void reloadCampaigns();
  }, [isProfileLoading, needsOnboarding, reloadCampaigns]);

  useEffect(() => {
    let mounted = true;
    if (campaignDraft.status !== "published" || !persistedCampaignId) {
      setCampaignRevenueStats(null);
      return;
    }
    const loadStats = () =>
      getCampaignRevenueStats(persistedCampaignId).then((stats) => {
        if (!mounted) return;
        setCampaignRevenueStats(stats);
      });
    void loadStats();
    const t = setInterval(() => void loadStats(), 8000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [campaignDraft.status, persistedCampaignId]);

  if (isProfileLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-shinhan-navy/20 border-t-shinhan-navy rounded-full animate-spin" />
          <p className="text-[13px] text-text-tertiary">Đang tải hồ sơ...</p>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    return <OnboardingFlow onComplete={finishOnboarding} />;
  }

  return (
    <main style={copilotKitThemeVars as CopilotKitCSSProperties} className="flex flex-1">
      <div className="flex-1 min-w-0 flex flex-col">
        <CampaignSubHeader status={campaignDraft.status} onReset={handleReset} />

        <div className="flex-1 overflow-y-auto scroll-container">
          <div className="app-content-container pt-6 pb-10">
            <p className="text-[11px] text-text-secondary mb-4 max-w-[min(100%,65ch)] leading-relaxed border-l-2 border-shinhan-gold/40 pl-3">
              {siteCopy.product.loyaltyContextLine}
            </p>
            <CampaignsPanel
              campaigns={campaigns}
              isLoading={isLoadingCampaigns}
              activeId={persistedCampaignId}
              onRefresh={reloadCampaigns}
              onOpen={handleOpenCampaign}
              onToggle={handleToggleCampaign}
              onDelete={handleDeleteCampaign}
            />
            <AnimatePresence mode="wait">
              {campaignDraft.status === "published" ? (
                <motion.div
                  key="dashboard"
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  variants={FADE_UP}
                >
                  <CampaignDashboard
                    campaign={campaignDraft}
                    estimation={estimation}
                    forecastDetails={forecastDetails}
                    revenueStats={campaignRevenueStats}
                  />
                </motion.div>
              ) : (
                <motion.div key="form" initial="hidden" animate="visible" exit="exit" variants={FADE_UP}>
                  <CampaignForm
                    draft={campaignDraft}
                    flashFields={flashFields}
                    estimation={estimation}
                    forecastDetails={forecastDetails}
                    onFieldChange={handleFieldChange}
                    onDiscountChange={handleDiscountChange}
                    onPublish={handlePublish}
                    isDraftReady={isDraftReady}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <SiteFooter />
        </div>
      </div>

      <CopilotSidebar
        clickOutsideToClose={false}
        defaultOpen={true}
        AssistantMessage={SmoothAssistantMessage}
        labels={{
          title: siteCopy.product.copilotTitle,
          initial: copilotProactiveGreeting(merchantProfile),
        }}
      />
    </main>
  );
}

function CampaignsPanel({
  campaigns,
  isLoading,
  activeId,
  onRefresh,
  onOpen,
  onToggle,
  onDelete,
}: {
  campaigns: CampaignRow[];
  isLoading: boolean;
  activeId: string | null;
  onRefresh: () => void;
  onOpen: (row: CampaignRow) => void;
  onToggle: (row: CampaignRow) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="mb-5 bg-surface-primary border border-border-primary/60 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[12px] text-text-tertiary">{siteCopy.campaign.panelEyebrow}</p>
          <h3 className="text-[15px] font-semibold text-text-primary">{siteCopy.campaign.panelTitle}</h3>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="cursor-pointer text-[11px] px-2.5 py-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-surface-secondary transition-colors duration-200"
        >
          {siteCopy.campaign.refresh}
        </button>
      </div>

      {isLoading ? (
        <ul className="space-y-2" aria-busy="true" aria-label="Đang tải danh sách chiến dịch">
          {[0, 1, 2].map((i) => (
            <li
              key={i}
              className="rounded-lg border border-border-primary/40 bg-surface-secondary/50 px-3 py-2.5 overflow-hidden"
            >
              <div
                className="h-3.5 rounded bg-border-primary/50 w-[min(52%,220px)] mb-2 motion-safe:animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
              <div
                className="h-2.5 rounded bg-border-primary/35 w-[min(38%,160px)] motion-safe:animate-pulse"
                style={{ animationDelay: `${i * 80 + 40}ms` }}
              />
            </li>
          ))}
        </ul>
      ) : campaigns.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-border-primary/80 bg-surface-secondary/60
            px-4 py-7 text-center"
        >
          <p className="text-[13px] font-medium text-text-secondary tracking-tight">
            Chưa có chiến dịch đã lưu
          </p>
          <p className="text-[12px] text-text-tertiary mt-2 max-w-[42ch] mx-auto leading-relaxed text-pretty">
            Hoàn thành form bên dưới và xuất bản để lưu chiến dịch đầu tiên. Danh sách cập nhật khi bạn
            xuất bản hoặc làm mới.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {campaigns.map((row) => (
            <li
              key={row.id}
              className={`border rounded-lg px-3 py-2.5 ${
                activeId === row.id ? "border-shinhan-navy/40 bg-shinhan-blue-light/30" : "border-border-primary/50"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[13px] font-medium text-text-primary">{row.title || "Chưa đặt tên"}</p>
                  <p className="text-[11px] text-text-tertiary tabular-nums">
                    {row.is_active ? "Đang bật" : "Đang tắt"} &bull;{" "}
                    {new Date(row.updated_at).toLocaleString("vi-VN")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onOpen(row)}
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-surface-secondary transition-colors duration-200"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Xem
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggle(row)}
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-border-primary text-text-secondary hover:bg-surface-secondary transition-colors duration-200"
                  >
                    <Power className="w-3.5 h-3.5" />
                    {row.is_active ? "Tắt" : "Bật"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(row.id)}
                    className="inline-flex cursor-pointer items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-md border border-status-warning text-status-warning hover:bg-status-warning-bg transition-colors duration-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xóa
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CampaignSubHeader({ status, onReset }: { status: CampaignStatus; onReset: () => void }) {
  return (
    <div className="border-b border-border-primary/40 bg-surface-secondary/50">
      <div className="app-content-container min-h-10 py-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-text-primary tracking-[-0.01em]">
          {siteCopy.campaign.subHeaderTitle}
        </span>
        <div className="flex items-center gap-2.5">
          <StatusIndicator status={status} />
          {status === "published" && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING}
              onClick={onReset}
              className="cursor-pointer text-[12px] font-medium text-shinhan-navy
                px-3.5 py-1.5 rounded-lg bg-shinhan-blue-light
                transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)]
                hover:bg-shinhan-navy hover:text-white active:scale-[0.97]"
            >
              Chiến dịch mới
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border-primary/50 mt-auto">
      <div className="app-content-container py-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Image
            src="/shinhan-logo.svg"
            alt="Shinhan Bank"
            width={80}
            height={14}
            className="h-3.5 w-auto opacity-40"
          />
          <span className="text-[11px] text-text-tertiary">{siteCopy.footer.productLine}</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] text-text-tertiary">
          <span>{siteCopy.footer.company}</span>
          <span className="hidden sm:block w-px h-3 bg-border-primary" aria-hidden />
          <span>
            Hotline:{" "}
            <a
              href={`tel:${siteCopy.footer.hotline.replace(/\s/g, "")}`}
              className="text-shinhan-navy hover:underline underline-offset-2"
            >
              {siteCopy.footer.hotline}
            </a>
          </span>
          <span className="hidden sm:block w-px h-3 bg-border-primary" aria-hidden />
          <a
            href={siteCopy.footer.websiteHref}
            target="_blank"
            rel="noreferrer"
            className="text-shinhan-navy hover:underline underline-offset-2"
          >
            {siteCopy.footer.website}
          </a>
        </div>
      </div>
    </footer>
  );
}

function StatusIndicator({ status }: { status: CampaignStatus }) {
  const config = {
    idle: {
      label: "Chưa bắt đầu",
      bg: "bg-surface-secondary",
      text: "text-text-tertiary",
      dot: "bg-text-tertiary",
    },
    drafting: {
      label: "Đang soạn",
      bg: "bg-status-warning-bg",
      text: "text-status-warning",
      dot: "bg-status-warning",
    },
    published: {
      label: "Hoạt động",
      bg: "bg-status-success-bg",
      text: "text-status-success",
      dot: "bg-status-success",
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium tracking-[0.01em] ${config.bg} ${config.text}`}
    >
      <span
        className={`status-pulse-dot w-1.5 h-1.5 rounded-full ${config.dot}`}
        style={{ animation: "pulse-dot 2.5s ease-in-out infinite" }}
      />
      {config.label}
    </span>
  );
}
