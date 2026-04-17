"use client";

import type { CampaignForecastDetails, DiscountConfig } from "@/lib/merchant-campaign/types";
import { formatCompact, formatVND } from "@/lib/formatCurrency";
import { getCampaignForecastDetails } from "@/utils/estimationEngine";
import type { CampaignRevenueStats } from "@/lib/supabase/ordersRepo";

type Scenario = { label: string; details: CampaignForecastDetails | null };

function ForecastKpiStrip({
  details,
  revenueStats,
}: {
  details: CampaignForecastDetails;
  revenueStats?: CampaignRevenueStats | null;
}) {
  const e = details.estimation;
  const avgRevenue = Math.round((e.estimatedRevenueMin + e.estimatedRevenueMax) / 2);
  const hasLiveStats = !!revenueStats;
  const actualPromoSpent = revenueStats?.paidDiscountVnd ?? details.actualBudgetSpent;
  const promoBudgetLeft = Math.max(0, details.merchantFundedPromoVnd - actualPromoSpent);
  const promoUsageRate = details.merchantFundedPromoVnd
    ? Math.round((actualPromoSpent / details.merchantFundedPromoVnd) * 100)
    : 0;
  const netAfterPromoSpend = avgRevenue - actualPromoSpent;
  const netAfterTotalBudget = avgRevenue - details.totalBudget;
  const roiStr = `${e.estimatedROI >= 0 ? "+" : ""}${e.estimatedROI}%`;
  const actualRevenue = revenueStats?.paidRevenueVnd ?? 0;
  const actualOrders = revenueStats?.paidOrders ?? 0;
  const pendingOrders = revenueStats?.pendingOrders ?? 0;
  const actualDiscount = revenueStats?.paidDiscountVnd ?? 0;
  const actualProgressPct =
    avgRevenue > 0 ? Math.min(999, Math.round((actualRevenue / avgRevenue) * 100)) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiTile
        label="Doanh thu hiện tại (đã thanh toán)"
        value={`${formatCompact(actualRevenue)} ₫`}
        sub={`${formatVND(actualOrders)} đơn paid • ${formatVND(pendingOrders)} đơn pending • giảm giá ghi nhận ${formatCompact(actualDiscount)} ₫`}
      />
      <KpiTile
        label="Doanh thu dự báo (TB)"
        value={`${formatCompact(avgRevenue)} ₫`}
        sub={`Tiến độ hiện tại: ${actualProgressPct}% • range ${formatCompact(e.estimatedRevenueMin)} – ${formatCompact(e.estimatedRevenueMax)} ₫`}
      />
      <KpiTile
        label={hasLiveStats ? "Ngân sách KM đã dùng" : "Ngân sách KM dự kiến dùng"}
        value={`${formatCompact(actualPromoSpent)} ₫`}
        sub={
          hasLiveStats
            ? `${promoUsageRate}% ngân sách KM sau phí (theo đơn paid)`
            : `${promoUsageRate}% ngân sách KM sau phí (ước tính theo engine)`
        }
      />
      <KpiTile
        label="Ngân sách KM còn lại"
        value={`${formatCompact(promoBudgetLeft)} ₫`}
        sub={
          hasLiveStats
            ? "Cập nhật theo mức giảm giá đã ghi nhận từ đơn paid"
            : `${formatVND(details.effectiveCodes)}/${formatVND(details.totalCodesIssued)} mã có thể đổi`
        }
      />
      <KpiTile
        label="Lợi nhuận ước tính"
        value={`${formatCompact(netAfterPromoSpend)} ₫`}
        valueClass={netAfterPromoSpend < 0 ? "text-status-error" : "text-status-success"}
        sub={`Sau tổng ngân sách: ${formatCompact(netAfterTotalBudget)} ₫ • ROI ${roiStr}`}
      />
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border-primary/50 bg-surface-secondary/55 p-3">
      <p className="text-[10px] font-medium text-text-tertiary mb-1">{label}</p>
      <p className={`text-[14px] font-semibold font-mono tracking-[-0.02em] ${valueClass ?? "text-text-primary"}`}>
        {value}
      </p>
      <p className="text-[10px] text-text-tertiary mt-1 leading-relaxed">{sub}</p>
    </div>
  );
}

function buildScenarios(
  budget: number,
  discount: DiscountConfig,
  current: CampaignForecastDetails,
): Scenario[] {
  const out: Scenario[] = [{ label: "Cấu hình hiện tại", details: current }];

  const isPct30 = discount.type === "percentage" && discount.value === 30;
  if (!isPct30) {
    const altPct = getCampaignForecastDetails(budget, {
      ...discount,
      type: "percentage",
      value: 30,
    });
    if (altPct) out.push({ label: "Giả định: giảm 30%", details: altPct });
  }

  const isFixed30k = discount.type === "fixed_amount" && discount.value === 30_000;
  if (!isFixed30k) {
    const altFixed = getCampaignForecastDetails(budget, {
      ...discount,
      type: "fixed_amount",
      value: 30_000,
    });
    if (altFixed) out.push({ label: "Giả định: giảm 30k", details: altFixed });
  }

  return out;
}

function BreakEvenChart({ details }: { details: CampaignForecastDetails }) {
  const margin = details.revenuePerConversion - details.costPerCode;
  if (margin <= 0) {
    return (
      <p className="text-[11px] text-text-tertiary">
        Biên đóng góp/đơn không dương — không vẽ được điểm hoà vốn theo mô hình hiện tại.
      </p>
    );
  }

  const maxOrders = Math.min(
    120,
    Math.max(16, details.breakEvenOrders * 2, Math.ceil(details.actualBudgetSpent / margin) + 4),
  );
  const maxY = Math.max(
    details.actualBudgetSpent * 1.08,
    maxOrders * margin * 1.05,
    1,
  );

  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const chartW = 360;
  const chartH = 140;
  const innerW = chartW - padL - padR;
  const innerH = chartH - padT - padB;

  const xScale = (orders: number) => padL + (orders / maxOrders) * innerW;
  const yScale = (val: number) => padT + innerH - (val / maxY) * innerH;

  const contribPts: string[] = [];
  const steps = 48;
  for (let s = 0; s <= steps; s++) {
    const orders = (maxOrders * s) / steps;
    const y = yScale(orders * margin);
    const x = xScale(orders);
    contribPts.push(`${x},${y}`);
  }
  const budgetY = yScale(details.actualBudgetSpent);
  const beX = xScale(details.breakEvenOrders);

  return (
    <div>
      <p className="text-[11px] font-medium text-text-secondary mb-2">Hoà vốn (lũy kế biên đóng góp vs ngân sách KM)</p>
      <svg
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="w-full h-auto text-shinhan-navy"
        role="img"
        aria-label="Biểu đồ hoà vốn"
      >
        <line
          x1={padL}
          y1={padT + innerH}
          x2={padL + innerW}
          y2={padT + innerH}
          className="stroke-border-primary/80"
          strokeWidth={1}
        />
        <line
          x1={padL}
          y1={padT}
          x2={padL}
          y2={padT + innerH}
          className="stroke-border-primary/80"
          strokeWidth={1}
        />
        <polyline
          fill="none"
          className="stroke-shinhan-navy"
          strokeWidth={2}
          strokeLinejoin="round"
          points={contribPts.join(" ")}
        />
        <line
          x1={padL}
          y1={budgetY}
          x2={padL + innerW}
          y2={budgetY}
          className="stroke-shinhan-gold"
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />
        {details.breakEvenOrders > 0 && details.breakEvenOrders <= maxOrders && (
          <line
            x1={beX}
            y1={padT}
            x2={beX}
            y2={padT + innerH}
            className="stroke-status-error/50"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
        <text x={padL} y={chartH - 6} className="fill-text-tertiary text-[9px]">
          0 đơn
        </text>
        <text x={padL + innerW - 40} y={chartH - 6} className="fill-text-tertiary text-[9px]">
          {maxOrders} đơn
        </text>
        <text x={padL + 4} y={padT + 10} className="fill-text-tertiary text-[8px]">
          {formatCompact(maxY)} ₫
        </text>
      </svg>
      <div className="flex flex-wrap gap-3 mt-2 text-[9px] text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-shinhan-navy rounded" />
          Lũy kế (đơn × (đơn TB − chi phí/mã))
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-shinhan-gold border border-dashed border-shinhan-gold" />
          Ngân sách KM đã căn ({formatCompact(details.actualBudgetSpent)} ₫)
        </span>
        {details.breakEvenOrders > 0 && (
          <span className="text-status-error/90">Giao điểm ~{details.breakEvenOrders} đơn</span>
        )}
      </div>
    </div>
  );
}

function BudgetVsLiabilityChart({ details }: { details: CampaignForecastDetails }) {
  const maxVal = Math.max(details.merchantFundedPromoVnd, details.maxPromoLiability, 1);
  const hBudget = Math.round((details.merchantFundedPromoVnd / maxVal) * 100);
  const hLiab = Math.round((details.maxPromoLiability / maxVal) * 100);

  return (
    <div>
      <p className="text-[11px] font-medium text-text-secondary mb-2">Ngân sách KM (sau phí) vs rủi ro chi phí tối đa</p>
      <div className="flex items-end gap-6 h-28 px-2">
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex justify-center items-end h-24 bg-shinhan-blue-light/30 rounded-t-md overflow-hidden">
            <div
              className="w-[55%] bg-shinhan-navy rounded-t-sm transition-all min-h-[4px]"
              style={{ height: `${hBudget}%` }}
            />
          </div>
          <span className="text-[9px] text-text-tertiary text-center leading-tight">
            Ngân sách KM
            <br />
            {formatCompact(details.merchantFundedPromoVnd)} ₫
          </span>
        </div>
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex justify-center items-end h-24 bg-shinhan-blue-light/30 rounded-t-md overflow-hidden">
            <div
              className="w-[55%] bg-status-error/70 rounded-t-sm transition-all min-h-[4px]"
              style={{ height: `${hLiab}%` }}
            />
          </div>
          <span className="text-[9px] text-text-tertiary text-center leading-tight">
            Rủi ro tối đa
            <br />
            {formatCompact(details.maxPromoLiability)} ₫
          </span>
        </div>
      </div>
    </div>
  );
}

function ScenarioCompare({ scenarios }: { scenarios: Scenario[] }) {
  const valid = scenarios.filter((s): s is Scenario & { details: CampaignForecastDetails } => !!s.details);
  if (valid.length < 2) return null;

  const maxConv = Math.max(...valid.map((s) => s.details.estimation.estimatedConversion), 1);

  return (
    <div>
      <p className="text-[11px] font-medium text-text-secondary mb-2">
        So sánh kịch bản (mô hình nội bộ, cùng ngân sách &amp; danh mục)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {valid.map((s) => {
          const e = s.details.estimation;
          const barH = Math.max(12, Math.round((e.estimatedConversion / maxConv) * 100));
          const roiStr = `${e.estimatedROI >= 0 ? "+" : ""}${e.estimatedROI}%`;
          return (
            <div
              key={s.label}
              className="rounded-lg border border-border-primary/50 bg-shinhan-blue-light/20 p-3"
            >
              <p className="text-[10px] font-semibold text-text-primary mb-2 leading-snug">{s.label}</p>
              <div className="h-16 w-full flex items-end rounded-md overflow-hidden bg-border-primary/25 mb-2">
                <div
                  className="w-full bg-shinhan-navy/85 rounded-t-sm transition-all"
                  style={{ height: `${barH}%` }}
                />
              </div>
              <p className="text-[10px] text-text-tertiary">
                Chuyển đổi dự kiến:{" "}
                <span className="font-mono text-text-primary">{formatVND(e.estimatedConversion)} đơn</span>
              </p>
              <p className="text-[10px] text-text-tertiary mt-0.5">
                ROI:{" "}
                <span
                  className={`font-mono ${e.estimatedROI < 0 ? "text-status-error" : "text-status-success"}`}
                >
                  {roiStr}
                </span>
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CampaignForecastCharts({
  details,
  budget,
  discount,
  revenueStats,
  compact,
}: {
  details: CampaignForecastDetails;
  budget: number;
  discount: DiscountConfig;
  revenueStats?: CampaignRevenueStats | null;
  /** Bỏ viền trên khi đặt trong card có tiêu đề riêng (dashboard). */
  compact?: boolean;
}) {
  const scenarios = buildScenarios(budget, discount, details);

  return (
    <div
      className={`space-y-5 ${compact ? "" : "mt-4 pt-4 border-t border-border-primary/50"}`}
    >
      <p className="text-[10px] text-text-tertiary leading-relaxed">
        Biểu đồ minh hoạ từ cùng engine với thẻ &quot;Dự báo hiệu quả chiến dịch&quot; (SOL phí 10% đã tách trong
        digest).
      </p>
      <ForecastKpiStrip details={details} revenueStats={revenueStats} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <BreakEvenChart details={details} />
        <BudgetVsLiabilityChart details={details} />
      </div>
      <ScenarioCompare scenarios={scenarios} />
    </div>
  );
}
