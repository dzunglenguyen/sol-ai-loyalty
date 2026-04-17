import type {
  BudgetEstimation,
  CampaignForecastDetails,
  DiscountConfig,
  DiscountType,
} from "@/lib/merchant-campaign/types";
import { formatCompact, formatVND } from "@/lib/formatCurrency";

/** Phí tiếp cận hệ sinh thái SOL — phần còn lại là ngân sách KM do Merchant chi trả khách. */
export const SOL_PLATFORM_FEE_RATE = 0.1;

export function splitCampaignBudget(totalBudget: number) {
  if (totalBudget <= 0) {
    return {
      totalBudget: 0,
      platformFeeVnd: 0,
      merchantFundedPromoVnd: 0,
    };
  }
  const platformFeeVnd = Math.round(totalBudget * SOL_PLATFORM_FEE_RATE);
  const merchantFundedPromoVnd = totalBudget - platformFeeVnd;
  return { totalBudget, platformFeeVnd, merchantFundedPromoVnd };
}

const CONVERSION_RATES: Record<DiscountType, { min: number; max: number }> = {
  percentage: { min: 0.08, max: 0.15 },
  fixed_amount: { min: 0.1, max: 0.18 },
  buy_x_get_y: { min: 0.06, max: 0.12 },
  freeship: { min: 0.12, max: 0.22 },
};

const AVG_ORDER_VALUES: Record<string, number> = {
  "Trà sữa": 55_000,
  Cafe: 45_000,
  "Đồ ăn nhanh": 85_000,
  "Nhà hàng": 180_000,
  "Thời trang": 350_000,
  "Mỹ phẩm": 250_000,
  default: 95_000,
};

export function getAvgOrderValue(categories: string): number {
  const cats = categories.split(",").map((c) => c.trim());
  let total = 0;
  let count = 0;

  for (const cat of cats) {
    for (const [key, val] of Object.entries(AVG_ORDER_VALUES)) {
      if (key !== "default" && cat.toLowerCase().includes(key.toLowerCase())) {
        total += val;
        count++;
        break;
      }
    }
  }

  return count > 0 ? total / count : AVG_ORDER_VALUES.default;
}

export function computeDiscountCost(discount: DiscountConfig, avgOrder: number): number {
  switch (discount.type) {
    case "percentage":
      return avgOrder * (discount.value / 100);
    case "fixed_amount":
      return discount.value;
    case "buy_x_get_y":
      return avgOrder * 0.5;
    case "freeship":
      return 25_000;
  }
}

function buildEstimation(
  budget: number,
  discount: DiscountConfig,
): CampaignForecastDetails | null {
  if (budget <= 0 || discount.value <= 0 || discount.totalCodes <= 0) return null;

  const { totalBudget, platformFeeVnd, merchantFundedPromoVnd } = splitCampaignBudget(budget);
  if (merchantFundedPromoVnd <= 0) return null;

  const avgOrder = getAvgOrderValue(discount.applicableCategories);
  const costPerCode = computeDiscountCost(discount, avgOrder);

  if (costPerCode <= 0) return null;

  const affordableCodes = Math.floor(merchantFundedPromoVnd / costPerCode);
  const effectiveCodes = Math.min(affordableCodes, discount.totalCodes);
  const maxPromoLiability = discount.totalCodes * costPerCode;

  const reachMultiplier = 2.5;
  const estimatedReach = Math.round(effectiveCodes * reachMultiplier);

  const rates = CONVERSION_RATES[discount.type];
  let valueBonusMult = 1;
  if (discount.type === "percentage" && discount.value >= 30) valueBonusMult = 1.2;
  if (discount.type === "percentage" && discount.value >= 50) valueBonusMult = 1.4;
  if (discount.type === "fixed_amount" && discount.value >= 50_000) valueBonusMult = 1.15;

  const convMin = rates.min * valueBonusMult;
  const convMax = rates.max * valueBonusMult;
  const avgConvRate = (convMin + convMax) / 2;
  const estimatedConversion = Math.round(estimatedReach * avgConvRate);

  const revenuePerConversion = avgOrder;
  const estimatedRevenueMin = Math.round(estimatedReach * convMin * revenuePerConversion);
  const estimatedRevenueMax = Math.round(estimatedReach * convMax * revenuePerConversion);

  const actualBudgetSpent = effectiveCodes * costPerCode;
  const avgRevenue = (estimatedRevenueMin + estimatedRevenueMax) / 2;
  const estimatedROI =
    actualBudgetSpent > 0
      ? Math.round(((avgRevenue - actualBudgetSpent) / actualBudgetSpent) * 100)
      : 0;

  const costPerAcquisition =
    estimatedConversion > 0 ? Math.round(actualBudgetSpent / estimatedConversion) : 0;

  const ordersToBreakEven =
    revenuePerConversion > costPerCode
      ? Math.ceil(actualBudgetSpent / (revenuePerConversion - costPerCode))
      : 0;

  const breakEvenPoint =
    ordersToBreakEven > 0 ? `${ordersToBreakEven} đơn hàng` : "Không khả thi";

  const estimation: BudgetEstimation = {
    estimatedReach,
    estimatedConversion,
    estimatedRevenueMin,
    estimatedRevenueMax,
    estimatedROI,
    costPerAcquisition,
    breakEvenPoint,
  };

  return {
    estimation,
    costPerCode,
    effectiveCodes,
    affordableCodes,
    platformFeeVnd,
    merchantFundedPromoVnd,
    totalBudget,
    maxPromoLiability,
    totalCodesIssued: discount.totalCodes,
    avgOrder,
    actualBudgetSpent,
    breakEvenOrders: ordersToBreakEven,
    revenuePerConversion,
  };
}

export function getCampaignForecastDetails(
  budget: number,
  discount: DiscountConfig,
): CampaignForecastDetails | null {
  return buildEstimation(budget, discount);
}

export function calculateEstimation(
  budget: number,
  discount: DiscountConfig,
): BudgetEstimation | null {
  const details = buildEstimation(budget, discount);
  return details?.estimation ?? null;
}

/**
 * Bản tóm KPI chuẩn (khớp EstimationCard) — dùng cho Copilot readable và prepend analyzeROI.
 */
export function formatForecastDigest(details: CampaignForecastDetails): string {
  const e = details.estimation;
  const roiSign = e.estimatedROI >= 0 ? "+" : "";
  return [
    "=== DỰ BÁO HIỆU QUẢ CHIẾN DỊCH (engine, nguồn chuẩn) ===",
    `Ngân sách tổng: ${formatVND(details.totalBudget)} VND`,
    `Phí nền tảng SOL (10%): ${formatVND(details.platformFeeVnd)} VND`,
    `Ngân sách KM do merchant chi (sau phí): ${formatVND(details.merchantFundedPromoVnd)} VND`,
    `Chi phí ước tính mỗi mã đổi (discount/đơn TB): ${formatVND(Math.round(details.costPerCode))} VND`,
    `Số mã có thể đổi trong ngân sách KM: ${details.effectiveCodes} (tối đa theo budget: ${details.affordableCodes} mã; đã phát hành: ${details.totalCodesIssued} mã)`,
    `Rủi ro chi phí tối đa nếu đổi hết mã đã phát hành: ${formatVND(details.maxPromoLiability)} VND (${details.totalCodesIssued} mã × chi phí/mã)`,
    `Đơn hàng TB (ngành hàng): ${formatVND(Math.round(details.avgOrder))} VND`,
    "--- KPI ---",
    `Lượt tiếp cận: ${formatVND(e.estimatedReach)} người`,
    `Chuyển đổi dự kiến: ${formatVND(e.estimatedConversion)} đơn`,
    `ROI dự kiến: ${roiSign}${e.estimatedROI}%`,
    `Doanh thu dự báo: ${formatCompact(e.estimatedRevenueMin)} – ${formatCompact(e.estimatedRevenueMax)} VND`,
    `Chi phí / khách (CPA): ${formatVND(e.costPerAcquisition)} VND`,
    `Điểm hoà vốn: ${e.breakEvenPoint}`,
    "=== KẾT THÚC DỰ BÁO ===",
  ].join("\n");
}
