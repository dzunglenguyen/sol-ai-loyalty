export type CampaignStatus = "idle" | "drafting" | "published";

export type DiscountType =
  | "percentage"
  | "fixed_amount"
  | "buy_x_get_y"
  | "freeship";

export interface DiscountConfig {
  type: DiscountType;
  value: number;
  minOrderValue: number;
  maxUsagePerUser: number;
  totalCodes: number;
  validityDays: number;
  applicableCategories: string;
}

export interface BudgetEstimation {
  estimatedReach: number;
  estimatedConversion: number;
  estimatedRevenueMin: number;
  estimatedRevenueMax: number;
  estimatedROI: number;
  costPerAcquisition: number;
  breakEvenPoint: string;
}

/** Full snapshot from estimation engine — charts, AI digest, Copilot context. */
export interface CampaignForecastDetails {
  estimation: BudgetEstimation;
  costPerCode: number;
  effectiveCodes: number;
  affordableCodes: number;
  platformFeeVnd: number;
  merchantFundedPromoVnd: number;
  totalBudget: number;
  /** Chi phí khuyến mãi tối đa nếu đổi hết mã (totalCodes × costPerCode). */
  maxPromoLiability: number;
  totalCodesIssued: number;
  avgOrder: number;
  actualBudgetSpent: number;
  breakEvenOrders: number;
  revenuePerConversion: number;
}

export interface CampaignDraft {
  title: string;
  targetAudience: string;
  discount: DiscountConfig;
  budget: number;
  pushMessage: string;
  status: CampaignStatus;
  estimation: BudgetEstimation | null;
  aiInsight: string | null;
}
