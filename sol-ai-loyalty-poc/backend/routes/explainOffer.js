/**
 * explainOffer.js — Express router for GET /api/explain-offer
 *
 * Flow:
 *  1. Validate user_id and campaign_id query params
 *  2. Look up campaign from seed data
 *  3. Look up user's top spending categories from seed data
 *  4. Call Qwen-Plus to generate a one-sentence Vietnamese explanation
 *  5. Return { explanation: string }
 *  6. On Qwen error / timeout: return { explanation: null, error: "QWEN_EXPLANATION_FAILED" }
 */

const express = require("express");
const router = express.Router();
const { USERS } = require("../db/seed");
const { getCampaignById } = require("../services/campaignService");
const { generateExplanation } = require("../services/qwenClient");

/**
 * GET /api/explain-offer?user_id=:userId&campaign_id=:campaignId
 */
router.get("/", async (req, res) => {
  const { user_id: userId, campaign_id: campaignId } = req.query;

  // Validate required params
  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    return res.status(400).json({
      code: "MISSING_USER_ID",
      message: "Query parameter user_id is required.",
      timestamp: new Date().toISOString(),
    });
  }

  if (!campaignId || typeof campaignId !== "string" || campaignId.trim() === "") {
    return res.status(400).json({
      code: "MISSING_CAMPAIGN_ID",
      message: "Query parameter campaign_id is required.",
      timestamp: new Date().toISOString(),
    });
  }

  // Look up campaign
  const campaign = await getCampaignById(campaignId.trim());
  if (!campaign) {
    return res.status(404).json({
      code: "CAMPAIGN_NOT_FOUND",
      message: `Campaign ${campaignId} not found.`,
      timestamp: new Date().toISOString(),
    });
  }

  // Look up user
  const user = USERS.find((u) => u.id === userId.trim());
  if (!user) {
    return res.status(404).json({
      code: "USER_NOT_FOUND",
      message: `User ${userId} not found.`,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const explanation = await generateExplanation(
      user.top_categories,
      campaign.target_demographic,
      campaign.merchant_name,
      campaign.promotional_copy
    );

    return res.json({ explanation });
  } catch (err) {
    console.error("[explainOffer] Qwen call failed:", err.message);
    return res.status(502).json({
      explanation: null,
      error: "QWEN_EXPLANATION_FAILED",
    });
  }
});

module.exports = router;
