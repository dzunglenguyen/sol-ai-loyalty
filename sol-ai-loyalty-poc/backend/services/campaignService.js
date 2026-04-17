const { supabase } = require("./supabaseClient");
const { CAMPAIGNS: SEED_CAMPAIGNS } = require("../db/seed");

/**
 * Transforms a Supabase campaign row (joined with merchant_profiles)
 * into the legacy Campaign structure used by the backend routes.
 *
 * @param {any} row
 * @returns {import('../types').Campaign}
 */
function transformCampaign(row) {
  const draft = row.draft || {};
  const discount = draft.discount || {};
  const merchant = row.merchant_profiles || {};

  return {
    id: row.id,
    merchant_id: row.merchant_key,
    merchant_name: merchant.business_name || "Unknown Merchant",
    merchant_lat: merchant.latitude,
    merchant_lng: merchant.longitude,
    promotional_copy: draft.pushMessage || row.title || "",
    discount_type: discount.type === "fixed_amount" ? "fixed" : "percentage",
    discount_value: discount.value || 0,
    max_discount_cap: discount.maxDiscountCap || 0,
    validity_start: row.created_at,
    validity_end: null,
    max_redemption_count: discount.totalCodes || 0,
    redemption_count: 0,
    budget_cap: draft.budget || 0,
    status: row.is_active && row.status === "published" ? "active" : "inactive",
    created_at: row.created_at,
    target_demographic: draft.targetAudience || "",
  };
}

/**
 * Returns the predefined seed campaigns (always available).
 */
function getSeedCampaigns() {
  return SEED_CAMPAIGNS.filter((c) => c.status === "active");
}

/**
 * Fetch all active campaigns from Supabase with joined merchant info.
 * Merges with seed data so the feed always has content.
 */
async function getActiveCampaigns() {
  const seedOffers = getSeedCampaigns();
  let supabaseOffers = [];

  try {
    // 1. Fetch campaigns from Supabase
    const { data: campaigns, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("is_active", true)
      .eq("status", "published");

    if (campaignError) {
      console.error("[campaignService] Supabase campaign fetch error:", campaignError.message);
    } else if (campaigns && campaigns.length > 0) {
      // 2. Fetch merchant profiles separately (manual join)
      const merchantKeys = [...new Set(campaigns.map((c) => c.merchant_key))];
      const { data: merchants, error: merchantError } = await supabase
        .from("merchant_profiles")
        .select("external_key, business_name, latitude, longitude")
        .in("external_key", merchantKeys);

      if (merchantError) {
        console.error("[campaignService] Error fetching merchant profiles:", merchantError.message);
      }

      // 3. Combine in code
      const merchantMap = (merchants || []).reduce((acc, m) => {
        acc[m.external_key] = m;
        return acc;
      }, {});

      const dataWithMerchants = campaigns.map((campaign) => ({
        ...campaign,
        merchant_profiles: merchantMap[campaign.merchant_key] || null,
      }));

      supabaseOffers = dataWithMerchants.map(transformCampaign);
    }
  } catch (err) {
    console.error("[campaignService] Supabase fetch failed, using seed only:", err.message);
  }

  // Deduplicate by id — Supabase campaigns take priority over seed
  const idSet = new Set(supabaseOffers.map((c) => c.id));
  const merged = [...supabaseOffers, ...seedOffers.filter((c) => !idSet.has(c.id))];

  return merged;
}

/**
 * Fetch a single campaign by ID.
 * Checks Supabase first, falls back to seed data.
 * @param {string} id
 */
async function getCampaignById(id) {
  // Try Supabase first
  try {
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (!campaignError && campaign) {
      const { data: merchant, error: merchantError } = await supabase
        .from("merchant_profiles")
        .select("external_key, business_name, latitude, longitude")
        .eq("external_key", campaign.merchant_key)
        .single();

      if (merchantError) {
        console.error(`[campaignService] Error fetching merchant profile for campaign ${id}:`, merchantError.message);
      }

      return transformCampaign({ ...campaign, merchant_profiles: merchant || null });
    }
  } catch (err) {
    console.error(`[campaignService] Supabase lookup failed for ${id}:`, err.message);
  }

  // Fallback to seed data
  const seedCampaign = SEED_CAMPAIGNS.find((c) => c.id === id);
  return seedCampaign || null;
}

module.exports = {
  getActiveCampaigns,
  getCampaignById,
};
