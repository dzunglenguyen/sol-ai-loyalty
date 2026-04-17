/**
 * QR routes — Dynamic QR generation endpoint.
 * POST /api/qr/generate
 */

const express = require("express");
const { generateDynamicQR } = require("../services/qrService");

const router = express.Router();

/**
 * POST /api/qr/generate
 * Body: { userId, merchantId, campaignId, paymentAmount, voucherCode }
 */
router.post("/generate", async (req, res) => {
  const { userId, merchantId, campaignId, paymentAmount, voucherCode } = req.body;

  // Validate all required fields
  const missing = [];
  if (!userId) missing.push("userId");
  if (!merchantId) missing.push("merchantId");
  if (!campaignId) missing.push("campaignId");
  if (paymentAmount === undefined || paymentAmount === null) missing.push("paymentAmount");
  if (!voucherCode) missing.push("voucherCode");

  if (missing.length > 0) {
    return res.status(400).json({
      code: "MISSING_FIELDS",
      message: `Missing required fields: ${missing.join(", ")}`,
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const result = await generateDynamicQR({
      userId,
      merchantId,
      campaignId,
      paymentAmount,
      voucherCode,
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("[qr/generate] Error:", err);
    return res.status(500).json({
      code: "QR_GENERATION_FAILED",
      message: "Failed to generate QR code",
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
