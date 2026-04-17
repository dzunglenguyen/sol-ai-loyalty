/**
 * offers.js — Express router for GET /api/offers
 *
 * Flow:
 *  1. Retrieve user embedding from DashVector (mock)
 *  2. Fetch active campaigns from PolarDB (mock seed data)
 *  3. Score campaigns via PAI-EAS (mock cosine similarity)
 *  4. Sort descending by propensity_score
 *  5. Return RankedOffer[] JSON
 *  6. On PAI-EAS failure: fallback to created_at DESC sort, set fallback: true
 */

const express = require("express");
const router = express.Router();
const { getUserEmbedding } = require("../services/dashVectorClient");
const { scoreOffers } = require("../services/paiEasClient");
const { getActiveCampaigns } = require("../services/campaignService");

/**
 * GET /api/offers?user_id=:userId
 */
router.get("/", async (req, res) => {
  const userId = req.query.user_id;

  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return res.status(400).json({
      code: "MISSING_USER_ID",
      message: "Query parameter user_id is required.",
      timestamp: new Date().toISOString(),
    });
  }

  let rankedOffers;
  let fallback = false;

  try {
    // Step 0: Fetch active campaigns from Supabase
    const activeCampaigns = await getActiveCampaigns();

    // Step 1: Get user embedding from DashVector
    const userDoc = await getUserEmbedding(userId.trim());

    // Step 2: Score via PAI-EAS
    const scores = await scoreOffers(userDoc.vector, activeCampaigns);

    // Step 3: Build a score map for O(1) lookup
    const scoreMap = new Map(scores.map((s) => [s.campaign_id, s.score]));

    // Step 4: Merge scores with campaigns and sort descending
    rankedOffers = activeCampaigns
      .map((campaign) => {
        const propensity_score = scoreMap.get(campaign.id) ?? 0;
        return {
          campaign,
          propensity_score,
          ai_match_pct: Math.round(propensity_score * 100),
        };
      })
      .sort((a, b) => b.propensity_score - a.propensity_score);
  } catch (err) {
    // PAI-EAS unavailable or Supabase fetch failed — fallback to created_at DESC
    console.error("[offers] Scoring or fetch failed, using fallback:", err.message);
    fallback = true;

    // We still need to try fetching campaigns if Supabase failed in Step 0
    // But if Step 0 failed, activeCampaigns is undefined.
    // Let's refactor slightly to ensure we have campaigns for fallback.
    let campaignsToUse = [];
    try {
      campaignsToUse = await getActiveCampaigns();
    } catch (e) {
      console.error("[offers] Critical: Failed to fetch campaigns even for fallback.");
    }

    rankedOffers = [...campaignsToUse]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .map((campaign) => ({
        campaign,
        propensity_score: 0,
        ai_match_pct: 0,
      }));
  }

  return res.json({ offers: rankedOffers, fallback });
});

module.exports = router;
