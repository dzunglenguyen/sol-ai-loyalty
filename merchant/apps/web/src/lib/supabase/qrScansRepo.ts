import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { QrScanRow } from "@/lib/supabase/tables";

export async function insertQrScan(params: {
  campaignId: string | null;
  qrPayload: string;
  status?: QrScanRow["status"];
  source?: string;
  metadata?: Record<string, unknown>;
}): Promise<QrScanRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("qr_scans")
    .insert({
      campaign_id: params.campaignId,
      qr_payload: params.qrPayload,
      status: params.status ?? "scanned",
      source: params.source ?? "simulated",
      metadata: params.metadata ?? {},
    })
    .select()
    .single();
  if (error) {
    console.error("[supabase] insertQrScan", error);
    return null;
  }
  return data as QrScanRow;
}

export async function listQrScansForCampaign(
  campaignId: string,
  limit = 50,
): Promise<QrScanRow[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const { data, error } = await sb
    .from("qr_scans")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[supabase] listQrScansForCampaign", error);
    return [];
  }
  return (data ?? []) as QrScanRow[];
}

export async function updateQrScanStatus(
  id: string,
  status: QrScanRow["status"],
): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const { error } = await sb.from("qr_scans").update({ status }).eq("id", id);
  if (error) {
    console.error("[supabase] updateQrScanStatus", error);
    return false;
  }
  return true;
}

/** Log a redeemed scan when a POS order is marked as paid. */
export async function insertQrScanForOrder(
  orderId: string,
  campaignId: string | null,
): Promise<QrScanRow | null> {
  return insertQrScan({
    campaignId,
    qrPayload: `ORDER:${orderId}`,
    status: "redeemed",
    source: "pos",
    metadata: { order_id: orderId },
  });
}

export async function getQrScanCountsForCampaigns(
  campaignIds: string[],
  rangeStartIso: string,
): Promise<{ total: number; byCampaignId: Record<string, number> }> {
  if (campaignIds.length === 0) {
    return { total: 0, byCampaignId: {} };
  }

  const sb = getSupabaseBrowserClient();
  if (!sb) return { total: 0, byCampaignId: {} };

  const { data, error } = await sb
    .from("qr_scans")
    .select("campaign_id")
    .in("campaign_id", campaignIds)
    .gte("created_at", rangeStartIso);

  if (error) {
    console.error("[supabase] getQrScanCountsForCampaigns", error);
    return { total: 0, byCampaignId: {} };
  }

  const byCampaignId: Record<string, number> = {};
  let total = 0;
  for (const row of data ?? []) {
    const campaignId = row.campaign_id as string | null;
    if (!campaignId) continue;
    byCampaignId[campaignId] = (byCampaignId[campaignId] ?? 0) + 1;
    total += 1;
  }

  return { total, byCampaignId };
}
