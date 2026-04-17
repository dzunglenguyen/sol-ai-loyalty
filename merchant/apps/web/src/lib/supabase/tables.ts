import type { CampaignDraft } from "@/lib/merchant-campaign/types";

export type CampaignRow = {
  id: string;
  merchant_key: string;
  title: string;
  draft: CampaignDraft;
  is_active: boolean;
  status: CampaignDraft["status"];
  created_at: string;
  updated_at: string;
};

export type QrScanRow = {
  id: string;
  campaign_id: string | null;
  qr_payload: string;
  status: "scanned" | "opened" | "redeemed" | "expired";
  source: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type MerchantProfileRow = {
  id: string;
  user_id: string | null;
  external_key: string;
  business_name: string | null;
  sector: string | null;
  address_text: string | null;
  maps_url: string | null;
  latitude: number | null;
  longitude: number | null;
  aov_vnd: number | null;
  peak_hours: string | null;
  customer_segment: string | null;
  ai_notes: string | null;
  created_at: string;
  updated_at: string;
};
