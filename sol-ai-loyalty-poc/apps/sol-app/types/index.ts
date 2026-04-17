export interface Campaign {
  id: string;
  merchant_id: string;
  merchant_name: string;
  promotional_copy: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  max_discount_cap: number;
  validity_start: string;
  validity_end: string;
  max_redemption_count: number;
  redemption_count: number;
  budget_cap: number;
  status: "active" | "paused" | "expired";
  created_at: string;
  merchant_lat?: number;
  merchant_lng?: number;
}

export interface RankedOffer {
  campaign: Campaign;
  propensity_score: number; // 0.0 – 1.0
  ai_match_pct: number;     // propensity_score × 100, rounded
}

export interface OffersResponse {
  offers: RankedOffer[];
  fallback: boolean;
}
