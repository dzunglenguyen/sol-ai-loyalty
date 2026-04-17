import type { CampaignDraft, DiscountConfig, DiscountType } from "@/lib/merchant-campaign/types";

export const INITIAL_DISCOUNT: DiscountConfig = {
  type: "percentage",
  value: 0,
  minOrderValue: 0,
  maxUsagePerUser: 1,
  totalCodes: 0,
  validityDays: 7,
  applicableCategories: "Tất cả",
};

export const INITIAL_DRAFT: CampaignDraft = {
  title: "",
  targetAudience: "",
  discount: { ...INITIAL_DISCOUNT },
  budget: 0,
  pushMessage: "",
  status: "idle",
  estimation: null,
  aiInsight: null,
};

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percentage: "Giảm theo %",
  fixed_amount: "Giảm tiền cố định",
  buy_x_get_y: "Mua X tặng Y",
  freeship: "Miễn phí vận chuyển",
};
