"use client";

import Image from "next/image";
import { useMemo } from "react";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { FADE_UP, STAGGER } from "@/components/merchant-campaign/animations";
import { CampaignForecastCharts } from "@/components/merchant-campaign/CampaignForecastCharts";
import {
  generatePredictiveData,
  PredictiveChart,
} from "@/components/merchant-campaign/PredictiveChart";
import { DISCOUNT_TYPE_LABELS } from "@/lib/merchant-campaign/constants";
import type { BudgetEstimation, CampaignDraft, CampaignForecastDetails } from "@/lib/merchant-campaign/types";
import type { CampaignRevenueStats } from "@/lib/supabase/ordersRepo";
import type { QrScanRow } from "@/lib/supabase/tables";
import { formatCompact, formatVND } from "@/lib/formatCurrency";

export function CampaignDashboard({
  campaign,
  estimation,
  forecastDetails,
  revenueStats,
}: {
  campaign: CampaignDraft;
  estimation: BudgetEstimation | null;
  forecastDetails: CampaignForecastDetails | null;
  revenueStats: CampaignRevenueStats | null;
}) {
  const est = estimation || campaign.estimation;
  const paidOrderScans = useMemo<QrScanRow[]>(
    () =>
      (revenueStats?.paidOrderTimestamps ?? []).map((ts, idx) => ({
        id: `paid-order-${idx}`,
        campaign_id: null,
        qr_payload: "ORDER_PAID",
        status: "redeemed",
        source: "orders_paid",
        metadata: { from: "orders" },
        created_at: ts,
      })),
    [revenueStats?.paidOrderTimestamps],
  );
  const predictive = useMemo(() => generatePredictiveData(est, paidOrderScans), [est, paidOrderScans]);

  const discountLabel = (() => {
    const discount = campaign.discount;
    switch (discount.type) {
      case "percentage":
        return `Giảm ${discount.value}%`;
      case "fixed_amount":
        return `Giảm ${formatVND(discount.value)} VND`;
      case "buy_x_get_y":
        return `Mua X tặng ${discount.value}`;
      case "freeship":
        return "Miễn phí vận chuyển";
    }
  })();

  return (
    <motion.div variants={STAGGER} initial="hidden" animate="visible">
      <motion.header variants={FADE_UP} className="mb-7">
        <h2 className="text-[24px] md:text-[28px] font-semibold tracking-[-0.025em] text-text-primary leading-[1.2]">
          {campaign.title || "Bảng điều khiển chiến dịch"}
        </h2>
        <p className="text-[13px] text-text-secondary mt-1.5 max-w-[50ch] leading-[1.6]">
          Chiến dịch đang hoạt động. Dữ liệu dự báo từ AI analytics.
        </p>
      </motion.header>

      <motion.div variants={FADE_UP} className="mb-4">
        <div
          className="bg-surface-primary rounded-xl border border-border-primary/60
            shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border-primary/50">
            <MetricBlock label="Khuyến mãi" value={discountLabel} />
            <MetricBlock
              label="Ngân sách"
              value={campaign.budget > 0 ? `${formatVND(campaign.budget)} VND` : "---"}
              mono
            />
            <MetricBlock
              label="ROI dự kiến"
              value={est ? `${est.estimatedROI >= 0 ? "+" : ""}${est.estimatedROI}%` : "---"}
              accent={!!est && est.estimatedROI >= 0}
            />
            <MetricBlock
              label="Doanh thu dự báo"
              value={
                est
                  ? `${formatCompact(est.estimatedRevenueMin)} – ${formatCompact(est.estimatedRevenueMax)}`
                  : "---"
              }
              mono
            />
          </div>
        </div>
      </motion.div>

      <motion.div variants={FADE_UP} className="mb-4">
        <div
          className="bg-surface-primary rounded-xl border border-border-primary/60
            shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="grid grid-cols-2 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-border-primary/50">
            <MetricBlock label="Loại KM" value={DISCOUNT_TYPE_LABELS[campaign.discount.type]} />
            <MetricBlock
              label="Đơn tối thiểu"
              value={
                campaign.discount.minOrderValue > 0
                  ? `${formatVND(campaign.discount.minOrderValue)} VND`
                  : "Không"
              }
              mono
            />
            <MetricBlock label="Tổng mã" value={formatVND(campaign.discount.totalCodes)} mono />
            <MetricBlock label="Hiệu lực" value={`${campaign.discount.validityDays} ngày`} />
            <MetricBlock
              label="Danh mục"
              value={campaign.discount.applicableCategories || "Tất cả"}
            />
          </div>
        </div>
      </motion.div>

      <motion.div variants={FADE_UP}>
        <PredictiveChart
          data={predictive.series}
          estimation={est}
          qrActivityTotal={predictive.qrActivityTotal}
        />
      </motion.div>

      {forecastDetails && (
        <motion.div variants={FADE_UP} className="mt-4">
          <div
            className="bg-surface-primary rounded-xl border border-border-primary/60
              shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-5"
          >
            <h4 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em] mb-1">
              Biểu đồ dự báo
            </h4>
            <CampaignForecastCharts
              details={forecastDetails}
              budget={campaign.budget}
              discount={campaign.discount}
              revenueStats={revenueStats}
              compact
            />
          </div>
        </motion.div>
      )}

      {campaign.aiInsight && (
        <motion.div variants={FADE_UP} className="mt-4">
          <div className="bg-shinhan-blue-light/50 rounded-xl border border-shinhan-navy/10 p-4">
            <div className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-md bg-shinhan-navy/10 flex items-center justify-center shrink-0 mt-0.5">
                <BarChart3 className="w-3.5 h-3.5 text-shinhan-navy" strokeWidth={2} />
              </div>
              <div>
                <p className="text-[12px] font-semibold text-shinhan-navy mb-1">Phân tích AI</p>
                <p className="text-[12px] text-text-secondary leading-[1.65] whitespace-pre-line">
                  {campaign.aiInsight}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {campaign.pushMessage && (
        <motion.div variants={FADE_UP} className="mt-4">
          <PushPreview message={campaign.pushMessage} title={campaign.title} />
        </motion.div>
      )}
    </motion.div>
  );
}

function MetricBlock({
  label,
  value,
  mono,
  accent,
}: {
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[11px] font-medium text-text-tertiary tracking-[0.02em] mb-1">{label}</p>
      <p
        className={`text-[15px] font-semibold tracking-[-0.01em] truncate
          ${mono ? "font-mono tabular-nums" : ""}
          ${accent ? "text-status-success" : "text-text-primary"}`}
      >
        {value}
      </p>
    </div>
  );
}

function PushPreview({
  message,
  title,
}: {
  message: string;
  title: string;
}) {
  return (
    <div
      className="bg-surface-primary rounded-xl border border-border-primary/60
        shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-5"
    >
      <h4 className="text-[13px] font-semibold text-text-primary tracking-[-0.01em] mb-3">
        Xem trước push notification
      </h4>

      <div className="bg-surface-secondary rounded-lg p-3.5 border border-border-primary/40">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md overflow-hidden bg-white flex items-center justify-center shadow-[0_1px_2px_rgba(0,57,127,0.15)]">
            <Image src="/favicon-32x32.png" alt="SOL" width={16} height={16} className="w-4 h-4 object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[11px] font-medium text-text-primary">SOL Loyalty</span>
          </div>
          <span className="text-[10px] text-text-tertiary shrink-0">Vừa xong</span>
        </div>
        <p className="text-[12px] text-text-secondary leading-[1.55]">{message}</p>
      </div>
    </div>
  );
}
