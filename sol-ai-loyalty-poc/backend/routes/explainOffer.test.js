/**
 * Tests for GET /api/explain-offer
 * Co-located with the route per project conventions.
 */

const request = require("supertest");
const app = require("../server");
const { CAMPAIGNS, USERS } = require("../db/seed");

// Mock qwenClient so tests don't need a real API key and are deterministic
jest.mock("../services/qwenClient", () => ({
  generateExplanation: jest.fn(async (userCategories, targetDemographic) => {
    // Return a deterministic mock explanation based on inputs
    return `Ưu đãi phù hợp với ${userCategories[0]} và nhắm đến ${targetDemographic}.`;
  }),
}));

const { generateExplanation } = require("../services/qwenClient");

describe("GET /api/explain-offer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when user_id is missing", async () => {
    const res = await request(app).get(
      `/api/explain-offer?campaign_id=${CAMPAIGNS[0].id}`
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_USER_ID");
  });

  it("returns 400 when campaign_id is missing", async () => {
    const res = await request(app).get(
      `/api/explain-offer?user_id=${USERS[0].id}`
    );
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_CAMPAIGN_ID");
  });

  it("returns 400 when both params are missing", async () => {
    const res = await request(app).get("/api/explain-offer");
    expect(res.status).toBe(400);
  });

  it("returns 200 with explanation string for valid params", async () => {
    const res = await request(app).get(
      `/api/explain-offer?user_id=${USERS[0].id}&campaign_id=${CAMPAIGNS[0].id}`
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("explanation");
    expect(typeof res.body.explanation).toBe("string");
  });

  it("explanation is a non-empty string", async () => {
    const res = await request(app).get(
      `/api/explain-offer?user_id=${USERS[1].id}&campaign_id=${CAMPAIGNS[1].id}`
    );
    expect(res.status).toBe(200);
    expect(res.body.explanation.length).toBeGreaterThan(0);
  });

  it("different (userId, campaignId) pairs return different explanations", async () => {
    // Each call gets a unique mock based on user categories + target demographic
    const res1 = await request(app).get(
      `/api/explain-offer?user_id=${USERS[0].id}&campaign_id=${CAMPAIGNS[0].id}`
    );
    const res2 = await request(app).get(
      `/api/explain-offer?user_id=${USERS[1].id}&campaign_id=${CAMPAIGNS[2].id}`
    );

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    // Different users/campaigns → different inputs to Qwen → different explanations
    expect(res1.body.explanation).not.toBe(res2.body.explanation);
  });

  it("returns 502 with QWEN_EXPLANATION_FAILED when Qwen throws", async () => {
    generateExplanation.mockRejectedValueOnce(new Error("Qwen timeout"));

    const res = await request(app).get(
      `/api/explain-offer?user_id=${USERS[0].id}&campaign_id=${CAMPAIGNS[0].id}`
    );
    expect(res.status).toBe(502);
    expect(res.body.error).toBe("QWEN_EXPLANATION_FAILED");
    expect(res.body.explanation).toBeNull();
  });

  it("calls generateExplanation with user top_categories and campaign target_demographic", async () => {
    const user = USERS[0];
    const campaign = CAMPAIGNS[0];

    await request(app).get(
      `/api/explain-offer?user_id=${user.id}&campaign_id=${campaign.id}`
    );

    expect(generateExplanation).toHaveBeenCalledWith(
      user.top_categories,
      campaign.target_demographic
    );
  });
});
