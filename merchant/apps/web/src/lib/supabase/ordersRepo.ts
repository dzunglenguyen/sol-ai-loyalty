import { getSupabaseBrowserClient, getCurrentMerchantKey } from "@/lib/supabase/client";
import type { OrderRow, OrderStatus } from "@/lib/pos/types";

export type CampaignRevenueStats = {
  totalOrders: number;
  paidOrders: number;
  pendingOrders: number;
  paidRevenueVnd: number;
  paidDiscountVnd: number;
  paidSubtotalVnd: number;
  /** Dùng để map sang "lượt quét QR" ở dashboard (1 đơn paid = 1 lượt quét). */
  paidOrderTimestamps: string[];
};

export type AnalyticsRangeKey = "15m" | "60m" | "today";

export type RevenueTrendPoint = {
  bucketStartIso: string;
  paidOrders: number;
  paidRevenueVnd: number;
};

export type TopCampaignRevenue = {
  campaignId: string | null;
  paidOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  paidRevenueVnd: number;
  paidDiscountVnd: number;
  netRevenueVnd: number;
};

export type StoreRevenueAnalytics = {
  rangeStartIso: string;
  nowIso: string;
  paidOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  paidRevenueVnd: number;
  paidDiscountVnd: number;
  grossRevenueVnd: number;
  averageOrderValueVnd: number;
  paidOrdersWithCampaign: number;
  campaignIdsInRange: string[];
  trend: RevenueTrendPoint[];
  topCampaigns: TopCampaignRevenue[];
};

function startIsoFromRange(range: AnalyticsRangeKey, now = new Date()): string {
  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  const mins = range === "15m" ? 15 : 60;
  return new Date(now.getTime() - mins * 60_000).toISOString();
}

export async function createOrder(data: {
  merchant_key: string;
  campaign_id?: string | null;
  items: OrderRow["items"];
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  qr_payload?: string | null;
  transfer_content?: string | null;
}): Promise<OrderRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data: row, error } = await sb
    .from("orders")
    .insert({
      merchant_key: data.merchant_key,
      campaign_id: data.campaign_id ?? null,
      items: data.items,
      subtotal: data.subtotal,
      discount_amount: data.discount_amount,
      total_amount: data.total_amount,
      qr_payload: data.qr_payload ?? null,
      transfer_content: data.transfer_content ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) {
    console.error("[supabase] createOrder", error);
    return null;
  }
  return row as OrderRow;
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb.from("orders").select("*").eq("id", id).maybeSingle();
  if (error) {
    console.error("[supabase] getOrder", error);
    return null;
  }
  return data as OrderRow | null;
}

export async function listOrders(opts?: {
  merchantKey?: string;
  limit?: number;
  status?: OrderStatus;
}): Promise<OrderRow[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const key = opts?.merchantKey ?? (await getCurrentMerchantKey());
  let query = sb
    .from("orders")
    .select("*")
    .eq("merchant_key", key)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.status) {
    query = query.eq("status", opts.status);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[supabase] listOrders", error);
    return [];
  }
  return (data ?? []) as OrderRow[];
}

export async function getCampaignRevenueStats(campaignId: string): Promise<CampaignRevenueStats> {
  const empty: CampaignRevenueStats = {
    totalOrders: 0,
    paidOrders: 0,
    pendingOrders: 0,
    paidRevenueVnd: 0,
    paidDiscountVnd: 0,
    paidSubtotalVnd: 0,
    paidOrderTimestamps: [],
  };

  const sb = getSupabaseBrowserClient();
  if (!sb) return empty;

  const { data, error } = await sb
    .from("orders")
    .select("status,total_amount,discount_amount,subtotal,paid_at,created_at")
    .eq("campaign_id", campaignId);

  if (error) {
    console.error("[supabase] getCampaignRevenueStats", error);
    return empty;
  }

  const rows = data ?? [];
  let paidOrders = 0;
  let pendingOrders = 0;
  let paidRevenueVnd = 0;
  let paidDiscountVnd = 0;
  let paidSubtotalVnd = 0;
  const paidOrderTimestamps: string[] = [];

  for (const row of rows) {
    const status = row.status as OrderStatus;
    if (status === "paid") {
      paidOrders += 1;
      paidRevenueVnd += Number(row.total_amount ?? 0);
      paidDiscountVnd += Number(row.discount_amount ?? 0);
      paidSubtotalVnd += Number(row.subtotal ?? 0);
      const ts = typeof row.paid_at === "string" && row.paid_at ? row.paid_at : row.created_at;
      if (typeof ts === "string" && ts) paidOrderTimestamps.push(ts);
    } else if (status === "pending") {
      pendingOrders += 1;
    }
  }

  return {
    totalOrders: rows.length,
    paidOrders,
    pendingOrders,
    paidRevenueVnd,
    paidDiscountVnd,
    paidSubtotalVnd,
    paidOrderTimestamps,
  };
}

export async function getStoreRevenueAnalytics(opts?: {
  merchantKey?: string;
  range?: AnalyticsRangeKey;
  trendBucketMinutes?: 5 | 10;
  topCampaignLimit?: number;
}): Promise<StoreRevenueAnalytics> {
  const now = new Date();
  const range = opts?.range ?? "60m";
  const rangeStartIso = startIsoFromRange(range, now);
  const bucketMinutes = opts?.trendBucketMinutes ?? 10;
  const topLimit = opts?.topCampaignLimit ?? 5;

  const empty: StoreRevenueAnalytics = {
    rangeStartIso,
    nowIso: now.toISOString(),
    paidOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    paidRevenueVnd: 0,
    paidDiscountVnd: 0,
    grossRevenueVnd: 0,
    averageOrderValueVnd: 0,
    paidOrdersWithCampaign: 0,
    campaignIdsInRange: [],
    trend: [],
    topCampaigns: [],
  };

  const sb = getSupabaseBrowserClient();
  if (!sb) return empty;
  const merchantKey = opts?.merchantKey ?? (await getCurrentMerchantKey());

  const { data, error } = await sb
    .from("orders")
    .select("campaign_id,status,total_amount,discount_amount,paid_at,created_at")
    .eq("merchant_key", merchantKey)
    .gte("created_at", rangeStartIso)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[supabase] getStoreRevenueAnalytics", error);
    return empty;
  }

  const rows = data ?? [];
  let paidOrders = 0;
  let pendingOrders = 0;
  let cancelledOrders = 0;
  let paidRevenueVnd = 0;
  let paidDiscountVnd = 0;

  const trendMap = new Map<string, RevenueTrendPoint>();
  const campaignMap = new Map<string, TopCampaignRevenue>();

  for (const row of rows) {
    const status = row.status as OrderStatus;
    const campaignId = (row.campaign_id as string | null) ?? null;
    const key = campaignId ?? "__none__";
    const item =
      campaignMap.get(key) ??
      ({
        campaignId,
        paidOrders: 0,
        pendingOrders: 0,
        cancelledOrders: 0,
        paidRevenueVnd: 0,
        paidDiscountVnd: 0,
        netRevenueVnd: 0,
      } satisfies TopCampaignRevenue);

    if (status === "paid") {
      const paidAmount = Number(row.total_amount ?? 0);
      const discountAmount = Number(row.discount_amount ?? 0);
      paidOrders += 1;
      paidRevenueVnd += paidAmount;
      paidDiscountVnd += discountAmount;
      item.paidOrders += 1;
      item.paidRevenueVnd += paidAmount;
      item.paidDiscountVnd += discountAmount;
      item.netRevenueVnd += paidAmount;

      const tsRaw =
        (typeof row.paid_at === "string" && row.paid_at) ||
        (typeof row.created_at === "string" && row.created_at) ||
        null;
      if (tsRaw) {
        const ts = new Date(tsRaw);
        if (!Number.isNaN(ts.getTime())) {
          const bucketEpoch = Math.floor(ts.getTime() / (bucketMinutes * 60_000)) * bucketMinutes * 60_000;
          const bucketStartIso = new Date(bucketEpoch).toISOString();
          const bucket =
            trendMap.get(bucketStartIso) ??
            ({ bucketStartIso, paidOrders: 0, paidRevenueVnd: 0 } satisfies RevenueTrendPoint);
          bucket.paidOrders += 1;
          bucket.paidRevenueVnd += paidAmount;
          trendMap.set(bucketStartIso, bucket);
        }
      }
    } else if (status === "pending") {
      pendingOrders += 1;
      item.pendingOrders += 1;
    } else if (status === "cancelled") {
      cancelledOrders += 1;
      item.cancelledOrders += 1;
    }

    campaignMap.set(key, item);
  }

  const grossRevenueVnd = paidRevenueVnd + paidDiscountVnd;
  const averageOrderValueVnd = paidOrders > 0 ? Math.round(paidRevenueVnd / paidOrders) : 0;
  const trend = Array.from(trendMap.values()).sort((a, b) => a.bucketStartIso.localeCompare(b.bucketStartIso));
  const campaignIdsInRange = Array.from(campaignMap.values())
    .map((item) => item.campaignId)
    .filter((id): id is string => !!id);
  const paidOrdersWithCampaign = Array.from(campaignMap.values())
    .filter((item) => item.campaignId !== null)
    .reduce((sum, item) => sum + item.paidOrders, 0);
  const topCampaigns = Array.from(campaignMap.values())
    .filter((item) => item.campaignId !== null)
    .sort((a, b) => b.paidRevenueVnd - a.paidRevenueVnd)
    .slice(0, topLimit);

  return {
    rangeStartIso,
    nowIso: now.toISOString(),
    paidOrders,
    pendingOrders,
    cancelledOrders,
    paidRevenueVnd,
    paidDiscountVnd,
    grossRevenueVnd,
    averageOrderValueVnd,
    paidOrdersWithCampaign,
    campaignIdsInRange,
    trend,
    topCampaigns,
  };
}

export async function markOrderAsPaid(id: string): Promise<OrderRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[supabase] markOrderAsPaid", error);
    return null;
  }
  return data as OrderRow;
}

export async function updateOrderQrPayload(
  id: string,
  qrPayload: string,
  transferContent?: string,
): Promise<OrderRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("orders")
    .update({
      qr_payload: qrPayload,
      transfer_content: transferContent ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[supabase] updateOrderQrPayload", error);
    return null;
  }
  return data as OrderRow;
}

export async function cancelOrder(id: string): Promise<OrderRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("orders")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("[supabase] cancelOrder", error);
    return null;
  }
  return data as OrderRow;
}
