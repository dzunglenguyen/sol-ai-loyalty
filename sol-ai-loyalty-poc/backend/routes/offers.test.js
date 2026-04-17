/**
 * Tests for GET /api/offers
 * Covers: sort order, fallback, field completeness, score range.
 * Co-located with the route per project conventions.
 */

const request = require("supertest");
const app = require("../server");
const { CAMPAIGNS } = require("../db/seed");

describe("GET /api/offers", () => {
  it("returns 400 when user_id is missing", async () => {
    const res = await request(app).get("/api/offers");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_USER_ID");
  });

  it("returns 200 with offers array and fallback flag", async () => {
    const res = await request(app).get("/api/offers?user_id=user_001");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("offers");
    expect(res.body).toHaveProperty("fallback");
    expect(Array.isArray(res.body.offers)).toBe(true);
  });

  it("returns only active campaigns", async () => {
    const res = await request(app).get("/api/offers?user_id=user_001");
    const activeCampaignIds = new Set(
      CAMPAIGNS.filter((c) => c.status === "active").map((c) => c.id)
    );
    for (const offer of res.body.offers) {
      expect(activeCampaignIds.has(offer.campaign.id)).toBe(true);
      expect(offer.campaign.status).toBe("active");
    }
  });

  it("returns offers sorted descending by propensity_score", async () => {
    const res = await request(app).get("/api/offers?user_id=user_001");
    const scores = res.body.offers.map((o) => o.propensity_score);
    for (let i = 0; i < scores.length - 1; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1]);
    }
  });

  it("each offer has all required fields", async () => {
    const res = await request(app).get("/api/offers?user_id=user_002");
    for (const offer of res.body.offers) {
      expect(offer).toHaveProperty("propensity_score");
      expect(offer).toHaveProperty("ai_match_pct");
      expect(offer.campaign).toHaveProperty("merchant_name");
      expect(offer.campaign).toHaveProperty("promotional_copy");
      expect(offer.campaign).toHaveProperty("discount_value");
      expect(offer.campaign).toHaveProperty("validity_end");
    }
  });

  it("propensity_score is in [0, 1] for all offers", async () => {
    const res = await request(app).get("/api/offers?user_id=user_003");
    for (const offer of res.body.offers) {
      expect(offer.propensity_score).toBeGreaterThanOrEqual(0);
      expect(offer.propensity_score).toBeLessThanOrEqual(1);
    }
  });

  it("ai_match_pct equals round(propensity_score * 100)", async () => {
    const res = await request(app).get("/api/offers?user_id=user_001");
    for (const offer of res.body.offers) {
      expect(offer.ai_match_pct).toBe(Math.round(offer.propensity_score * 100));
    }
  });

  it("different users get different score orderings", async () => {
    const res1 = await request(app).get("/api/offers?user_id=user_001");
    const res2 = await request(app).get("/api/offers?user_id=user_002");
    const ids1 = res1.body.offers.map((o) => o.campaign.id).join(",");
    const ids2 = res2.body.offers.map((o) => o.campaign.id).join(",");
    // Different users should produce different rankings (seeded embeddings differ)
    expect(ids1).not.toBe(ids2);
  });
});
