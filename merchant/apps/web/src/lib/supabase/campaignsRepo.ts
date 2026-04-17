import type { CampaignDraft } from "@/lib/merchant-campaign/types";
import { getSupabaseBrowserClient, getCurrentMerchantKey } from "@/lib/supabase/client";
import type { CampaignRow } from "@/lib/supabase/tables";

function mapRow(row: {
  id: string;
  merchant_key: string;
  title: string;
  draft: unknown;
  is_active: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}): CampaignRow {
  return {
    id: row.id,
    merchant_key: row.merchant_key,
    title: row.title,
    draft: row.draft as CampaignDraft,
    is_active: row.is_active,
    status: row.status as CampaignDraft["status"],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function logSupabaseError(scope: string, error: { message?: string; code?: string; details?: string; hint?: string }) {
  console.error(
    `[supabase] ${scope}`,
    error?.message ?? error,
    error?.code ?? "",
    error?.details ?? "",
    error?.hint ?? "",
  );
}

export async function listCampaigns(merchantKey?: string): Promise<CampaignRow[]> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return [];
  const key = merchantKey ?? await getCurrentMerchantKey();
  const { data, error } = await sb
    .from("campaigns")
    .select("*")
    .eq("merchant_key", key)
    .order("updated_at", { ascending: false });
  if (error) {
    logSupabaseError("listCampaigns", error);
    return [];
  }
  return (data ?? []).map(mapRow);
}

export async function getCampaign(id: string): Promise<CampaignRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb.from("campaigns").select("*").eq("id", id).maybeSingle();
  if (error) {
    logSupabaseError("getCampaign", error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function insertCampaign(
  draft: CampaignDraft,
  merchantKey?: string,
): Promise<CampaignRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const key = merchantKey ?? await getCurrentMerchantKey();
  const { data, error } = await sb
    .from("campaigns")
    .insert({
      merchant_key: key,
      title: draft.title,
      draft,
      is_active: true,
      status: draft.status,
    })
    .select()
    .single();
  if (error) {
    logSupabaseError("insertCampaign", error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function updateCampaign(
  id: string,
  draft: CampaignDraft,
): Promise<CampaignRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("campaigns")
    .update({
      title: draft.title,
      draft,
      status: draft.status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) {
    logSupabaseError("updateCampaign", error);
    return null;
  }
  return data ? mapRow(data) : null;
}

export async function deleteCampaign(id: string): Promise<boolean> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return false;
  const { error } = await sb.from("campaigns").delete().eq("id", id);
  if (error) {
    logSupabaseError("deleteCampaign", error);
    return false;
  }
  return true;
}

export async function setCampaignActive(id: string, isActive: boolean): Promise<CampaignRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from("campaigns")
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    logSupabaseError("setCampaignActive", error);
    return null;
  }
  return data ? mapRow(data) : null;
}

/** Create or update — used on publish and while editing if id exists. */
export async function upsertCampaignFromDraft(
  draft: CampaignDraft,
  existingId: string | null,
  merchantKey?: string,
): Promise<CampaignRow | null> {
  if (existingId) {
    return updateCampaign(existingId, draft);
  }
  return insertCampaign(draft, merchantKey);
}
