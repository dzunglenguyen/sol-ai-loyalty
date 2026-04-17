import { getSupabaseBrowserClient, getCurrentMerchantKey } from "@/lib/supabase/client";
import type { MerchantProfileRow } from "@/lib/supabase/tables";

function logSupabaseError(scope: string, error: { message?: string; code?: string; details?: string; hint?: string }) {
  console.error(
    `[supabase] ${scope}`,
    error?.message ?? error,
    error?.code ?? "",
    error?.details ?? "",
    error?.hint ?? "",
  );
}

export async function upsertMerchantProfile(
  row: Omit<MerchantProfileRow, "id" | "created_at" | "updated_at" | "user_id">,
): Promise<MerchantProfileRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) {
    console.error("[supabase] upsertMerchantProfile: Supabase client is null — check NEXT_PUBLIC_SUPABASE_URL env var");
    return null;
  }
  if (!row.external_key) {
    console.error("[supabase] upsertMerchantProfile: external_key is empty — Clerk user ID not available yet");
    return null;
  }

  const payload = {
    external_key: row.external_key,
    business_name: row.business_name,
    sector: row.sector,
    address_text: row.address_text,
    maps_url: row.maps_url,
    latitude: row.latitude,
    longitude: row.longitude,
    aov_vnd: row.aov_vnd,
    peak_hours: row.peak_hours,
    customer_segment: row.customer_segment,
    ai_notes: row.ai_notes,
    updated_at: new Date().toISOString(),
  };

  const { data: existing, error: selErr } = await sb
    .from("merchant_profiles")
    .select("id")
    .eq("external_key", row.external_key)
    .maybeSingle();

  if (selErr) {
    logSupabaseError("upsertMerchantProfile(select)", selErr);
    return null;
  }

  if (existing?.id) {
    const { data, error } = await sb
      .from("merchant_profiles")
      .update(payload)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) {
      logSupabaseError("upsertMerchantProfile(update)", error);
      return null;
    }
    return data as MerchantProfileRow;
  }

  const { data, error } = await sb.from("merchant_profiles").insert(payload).select("*").single();
  if (error) {
    logSupabaseError("upsertMerchantProfile(insert)", error);
    return null;
  }
  return data as MerchantProfileRow;
}

export async function getMerchantProfile(
  externalKey?: string,
): Promise<MerchantProfileRow | null> {
  const sb = getSupabaseBrowserClient();
  if (!sb) return null;
  const key = externalKey ?? await getCurrentMerchantKey();
  if (!key) return null;
  const { data, error } = await sb
    .from("merchant_profiles")
    .select("*")
    .eq("external_key", key)
    .maybeSingle();
  if (error) {
    console.error("[supabase] getMerchantProfile", error);
    return null;
  }
  return data as MerchantProfileRow | null;
}
