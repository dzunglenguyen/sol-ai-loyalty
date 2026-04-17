/**
 * Orders routes — Fetch order details by ID.
 * GET /api/orders/:id
 */

const express = require("express");
const { supabase } = require("../services/supabaseClient");

const router = express.Router();
const FIXED_CAMPAIGN_ID = "79f4c8ec-1b27-4e0a-bbe7-a58156fde00d";

/**
 * Helper to calculate discount based on type and value.
 */
function calculateDiscount(baseAmount, discountConfig) {
  if (!discountConfig) return 0;

  // Ensure config is an object
  let config = discountConfig;
  try {
    if (typeof config === 'string') config = JSON.parse(config);
  } catch (e) {
    console.error("Error parsing discount config:", e);
    return 0;
  }

  const { type, value, minOrderValue } = config;
  const numericBase = Number(baseAmount) || 0;
  const numericValue = Number(value) || 0;
  const numericMin = Number(minOrderValue) || 0;

  // 1. Check minimum order value condition
  if (numericMin > 0 && numericBase < numericMin) {
    console.log(`[calculateDiscount] Minimum order value not met: ${numericBase} < ${numericMin}`);
    return 0;
  }

  // 2. Calculate based on type
  if (type === "fixed_amount" || type === "freeship") {
    return numericValue;
  } else if (type === "percentage") {
    return (numericBase * numericValue) / 100;
  }

  return 0;
}
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      code: "MISSING_ID",
      message: "Order ID is required",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, discount_amount, total_amount, subtotal, status")
      .eq("id", id)
      .single();

    if (error) {
      console.error(`[orders/get] DB Error for ID ${id}:`, error);
      return res.status(error.code === "PGRST116" ? 404 : 500).json({
        code: error.code === "PGRST116" ? "ORDER_NOT_FOUND" : "DATABASE_ERROR",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    // --- Start: Discount Calculation Logic ---
    let discountAmount = 0;
    try {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("draft")
        .eq("id", FIXED_CAMPAIGN_ID)
        .single();

      if (campaign?.draft?.discount) {
        const baseAmount = data.subtotal || data.total_amount || 0;
        discountAmount = calculateDiscount(baseAmount, campaign.draft.discount);
      }
    } catch (campaignErr) {
      console.error("[orders/get] Failed to fetch campaign for discount:", campaignErr);
    }

    const finalData = {
      ...data,
      discount_amount: discountAmount,
      payable_amount: (data.subtotal || data.total_amount || 0) - discountAmount,
      discount_percentage: discountAmount > 0 ? (discountAmount / (data.subtotal || data.total_amount)) * 100 : 0
    };
    // --- End: Discount Calculation Logic ---

    return res.status(200).json(finalData);
  } catch (err) {
    console.error(`[orders/get] Unexpected Error for ID ${id}:`, err);
    return res.status(500).json({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * PATCH /api/orders/:id/status
 * Updates the order status (e.g., to 'paid').
 */
router.patch("/:id/status", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!id || !status) {
    return res.status(400).json({
      code: "MISSING_FIELDS",
      message: "Order ID and status are required",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    // 1. Fetch the existing order to get subtotal/total
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("subtotal, total_amount")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      console.error(`[orders/patch] Fetch Error for ID ${id}:`, fetchError);
      return res.status(404).json({ code: "ORDER_NOT_FOUND", message: "Order not found" });
    }

    // 2. Calculate discount using the fixed campaign
    let discountAmount = 0;
    try {
      const { data: campaign } = await supabase
        .from("campaigns")
        .select("draft")
        .eq("id", FIXED_CAMPAIGN_ID)
        .single();

      if (campaign?.draft?.discount) {
        const baseAmount = order.subtotal || order.total_amount || 0;
        discountAmount = calculateDiscount(baseAmount, campaign.draft.discount);
      }
    } catch (campaignErr) {
      console.error("[orders/patch] Failed to fetch campaign for update:", campaignErr);
    }

    const finalPayable = (order.subtotal || order.total_amount || 0) - discountAmount;

    // 3. Perform the update with campaign association
    const { data, error } = await supabase
      .from("orders")
      .update({
        status,
        campaign_id: FIXED_CAMPAIGN_ID,
        discount_amount: discountAmount,
        total_amount: finalPayable
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(`[orders/patch] DB Error for ID ${id}:`, error);
      return res.status(500).json({
        code: "DATABASE_ERROR",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error(`[orders/patch] Unexpected Error for ID ${id}:`, err);
    return res.status(500).json({
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred",
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
