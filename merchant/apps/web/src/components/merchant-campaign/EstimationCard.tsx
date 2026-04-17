import { BarChart3, DollarSign, Landmark, Target, TrendingUp, Users, Zap } from "lucide-react";
import type { BudgetEstimation } from "@/lib/merchant-campaign/types";
import { formatCompact, formatVND } from "@/lib/formatCurrency";
import { SOL_PLATFORM_FEE_RATE, splitCampaignBudget } from "@/utils/estimationEngine";

export function EstimationCard({
  estimation,
  totalBudget,
}: {
  estimation: BudgetEstimation;
  totalBudget: number;
}) {
  const roiColor =
    estimation.estimatedROI >= 100
      ? "text-status-success"
      : estimation.estimatedROI >= 0
        ? "text-status-warning"
        : "text-status-error";

  const split = splitCampaignBudget(totalBudget);
  const platformFeePct = Math.round(SOL_PLATFORM_FEE_RATE * 100);

  return (
    <div className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-3.5 h-3.5 text-shinhan-navy" strokeWidth={2} />
        <h4 className="text-[12px] font-semibold text-shinhan-navy tracking-[0.01em]">
          Dự báo hiệu quả chiến dịch
        </h4>
      </div>

      {totalBudget > 0 && (
        <div
          className="mb-5 rounded-lg border border-shinhan-navy/15 bg-shinhan-blue-light/40 px-3.5 py-3 space-y-2
            text-[11px] leading-[1.55] text-text-secondary"
        >
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-shinhan-navy">
            <Landmark className="w-3 h-3 shrink-0" strokeWidth={2} />
            Phân bổ ngân sách &amp; phí (fee-based)
          </div>
          <div className="flex justify-between gap-3 border-b border-border-primary/40 pb-2">
            <span>Ngân sách khuyến mãi khách (Merchant-funded)</span>
            <span className="font-mono tabular-nums font-semibold text-text-primary shrink-0">
              {formatVND(split.merchantFundedPromoVnd)} VND
            </span>
          </div>
          <div className="flex justify-between gap-3 border-b border-border-primary/40 pb-2">
            <span>
              Phí dịch vụ tiếp cận hệ sinh thái SOL (SOL Platform Fee — {platformFeePct}%)
            </span>
            <span className="font-mono tabular-nums font-semibold text-shinhan-navy shrink-0">
              {formatVND(split.platformFeeVnd)} VND
            </span>
          </div>
          <p className="text-[10px] text-text-tertiary pt-0.5">
            Phí giao dịch thẻ / SOL Pay (MDR — 1%): khấu trừ trên từng giao dịch, không trừ vào ngân sách KM
            phía trên.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <EstimationMetric
          label="Lượt tiếp cận"
          value={formatVND(estimation.estimatedReach)}
          suffix="người"
          icon={<Users className="w-3 h-3" />}
        />
        <EstimationMetric
          label="Chuyển đổi dự kiến"
          value={formatVND(estimation.estimatedConversion)}
          suffix="đơn"
          icon={<Target className="w-3 h-3" />}
        />
        <EstimationMetric
          label="ROI dự kiến"
          value={`${estimation.estimatedROI >= 0 ? "+" : ""}${estimation.estimatedROI}%`}
          className={roiColor}
          icon={<TrendingUp className="w-3 h-3" />}
        />
        <EstimationMetric
          label="Doanh thu dự báo"
          value={`${formatCompact(estimation.estimatedRevenueMin)} – ${formatCompact(estimation.estimatedRevenueMax)}`}
          suffix="VND"
          icon={<DollarSign className="w-3 h-3" />}
        />
        <EstimationMetric
          label="Chi phí / khách"
          value={formatVND(estimation.costPerAcquisition)}
          suffix="VND"
          icon={<BarChart3 className="w-3 h-3" />}
        />
        <EstimationMetric
          label="Điểm hoà vốn"
          value={estimation.breakEvenPoint}
          icon={<Zap className="w-3 h-3" />}
        />
      </div>
    </div>
  );
}

function EstimationMetric({
  label,
  value,
  suffix,
  icon,
  className,
}: {
  label: string;
  value: string;
  suffix?: string;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="estimation-metric">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-text-tertiary">{icon}</span>
        <p className="text-[10px] text-text-tertiary tracking-[0.01em]">{label}</p>
      </div>
      <p
        className={`text-[14px] font-semibold font-mono tabular-nums tracking-[-0.02em] ${className || "text-text-primary"}`}
      >
        {value}
        {suffix && (
          <span className="text-[10px] font-normal text-text-tertiary ml-1">{suffix}</span>
        )}
      </p>
    </div>
  );
}
