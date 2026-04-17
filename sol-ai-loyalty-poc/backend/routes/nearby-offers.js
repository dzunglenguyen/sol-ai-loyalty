/**
 * nearby-offers.js — Express router for GET /api/nearby-offers
 *
 * Returns active campaigns whose merchant location is within `radius_km`
 * of the user's current position (Haversine distance).
 *
 * Query params:
 *   user_id    — required, string
 *   lat        — required, number (user latitude)
 *   lng        — required, number (user longitude)
 *   radius_km  — optional, number, default 1
 */

const express = require("express");
const router = express.Router();
const { getActiveCampaigns } = require("../services/campaignService");

/**
 * Haversine great-circle distance in kilometres.
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number}
 */
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * GET /api/nearby-offers?user_id=&lat=&lng=&radius_km=1
 */
router.get("/", async (req, res) => {
  const { user_id, lat, lng, radius_km } = req.query;

  // ── Validate required params ────────────────────────────────────────────────
  if (!user_id || typeof user_id !== "string" || user_id.trim() === "") {
    return res.status(400).json({
      code: "MISSING_USER_ID",
      message: "Query parameter user_id is required.",
      timestamp: new Date().toISOString(),
    });
  }

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);

  if (isNaN(parsedLat) || isNaN(parsedLng)) {
    return res.status(400).json({
      code: "INVALID_COORDS",
      message: "Query parameters lat and lng must be valid numbers.",
      timestamp: new Date().toISOString(),
    });
  }

  const radiusKm = parseFloat(radius_km) || 1;

  try {
    // ── Filter campaigns by proximity ───────────────────────────────────────────
    const activeCampaigns = await getActiveCampaigns();

    const nearbyOffers = activeCampaigns
      .filter(
        (c) =>
          c.merchant_lat != null &&
          c.merchant_lng != null &&
          distanceKm(parsedLat, parsedLng, c.merchant_lat, c.merchant_lng) <=
          radiusKm
      )
      .map((c) => ({
        campaign: c,
        distance_km: parseFloat(
          distanceKm(parsedLat, parsedLng, c.merchant_lat, c.merchant_lng).toFixed(2)
        ),
      }))
      .sort((a, b) => a.distance_km - b.distance_km);

    return res.json({
      user_id: user_id.trim(),
      user_lat: parsedLat,
      user_lng: parsedLng,
      radius_km: radiusKm,
      nearby_offers: nearbyOffers,
      count: nearbyOffers.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[nearby-offers] Failed to fetch campaigns from Supabase:", error.message);
    return res.status(500).json({
      code: "INTERNAL_ERROR",
      message: "Failed to fetch nearby offers.",
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
