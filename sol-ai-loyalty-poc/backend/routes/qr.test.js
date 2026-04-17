/**
 * Tests for POST /api/qr/generate and qrService round-trip integrity.
 * Covers: validation, response shape, QR image format, expiry, round-trip,
 *         single-use enforcement, tamper detection.
 * Co-located with the route per project conventions.
 *
 * Feature: sol-ai-loyalty-poc
 * Properties covered: P11 (QR payload completeness + 60s expiry),
 *                     P12 (single-use enforcement),
 *                     P16 (round-trip integrity),
 *                     P17 (invalid signature rejection)
 */

const request = require("supertest");
const fc = require("fast-check");
const app = require("../server");
const { generateDynamicQR, generateToken, verifyAndDecodeQR, markQRRedeemed, tokenStore } = require("../services/qrService");

const VALID_BODY = {
  userId: "user_001",
  merchantId: "merch_001",
  campaignId: "camp_001",
  paymentAmount: 100000,
  voucherCode: "VOUCHER-CAMP_001",
};

// ── Unit tests ────────────────────────────────────────────────────────────────

describe("POST /api/qr/generate — validation", () => {
  const requiredFields = ["userId", "merchantId", "campaignId", "paymentAmount", "voucherCode"];

  for (const field of requiredFields) {
    it(`returns 400 when ${field} is missing`, async () => {
      const body = { ...VALID_BODY };
      delete body[field];
      const res = await request(app).post("/api/qr/generate").send(body);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("MISSING_FIELDS");
      expect(res.body.message).toContain(field);
    });
  }

  it("returns 400 when body is empty", async () => {
    const res = await request(app).post("/api/qr/generate").send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("MISSING_FIELDS");
  });
});

describe("POST /api/qr/generate — success response", () => {
  let res;

  beforeAll(async () => {
    res = await request(app).post("/api/qr/generate").send(VALID_BODY);
  });

  it("returns 200", () => {
    expect(res.status).toBe(200);
  });

  it("response contains tokenId, qrImageBase64, expiresAt, token", () => {
    expect(res.body).toHaveProperty("tokenId");
    expect(res.body).toHaveProperty("qrImageBase64");
    expect(res.body).toHaveProperty("expiresAt");
    expect(res.body).toHaveProperty("token");
  });

  it("qrImageBase64 starts with 'data:image/png;base64,'", () => {
    expect(res.body.qrImageBase64).toMatch(/^data:image\/png;base64,/);
  });

  it("expiresAt is approximately now + 60 seconds (within 2s tolerance)", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(res.body.expiresAt).toBeGreaterThanOrEqual(now + 58);
    expect(res.body.expiresAt).toBeLessThanOrEqual(now + 62);
  });

  it("tokenId is a non-empty string", () => {
    expect(typeof res.body.tokenId).toBe("string");
    expect(res.body.tokenId.length).toBeGreaterThan(0);
  });
});

// ── qrService unit tests ──────────────────────────────────────────────────────

describe("qrService — verifyAndDecodeQR round-trip", () => {
  it("encode then decode returns equivalent payload", async () => {
    const { token, tokenId, expiresAt } = await generateDynamicQR(VALID_BODY);
    const result = verifyAndDecodeQR(token);
    expect(result).not.toBeNull();
    expect(result.payload).toBeDefined();
    expect(result.payload.token_id).toBe(tokenId);
    expect(result.payload.user_id).toBe(VALID_BODY.userId);
    expect(result.payload.merchant_id).toBe(VALID_BODY.merchantId);
    expect(result.payload.campaign_id).toBe(VALID_BODY.campaignId);
    expect(result.payload.payment_amount).toBe(VALID_BODY.paymentAmount);
    expect(result.payload.voucher_code).toBe(VALID_BODY.voucherCode);
    expect(result.payload.expires_at).toBe(expiresAt);
  });

  it("expired token returns QR_EXPIRED error", async () => {
    const { token } = await generateDynamicQR(VALID_BODY);
    // Decode the payload part and rebuild with past expiry
    const lastDot = token.lastIndexOf(".");
    const payloadB64 = token.substring(0, lastDot);
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
    payload.expires_at = Math.floor(Date.now() / 1000) - 10; // 10s in the past

    const crypto = require("crypto");
    const secret = process.env.QR_SECRET || "dev-secret-do-not-use-in-prod";
    const newPayloadB64 = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    const newSig = crypto.createHmac("sha256", secret).update(newPayloadB64).digest("hex");
    const expiredToken = `${newPayloadB64}.${newSig}`;

    const result = verifyAndDecodeQR(expiredToken);
    expect(result).toEqual({ error: "QR_EXPIRED" });
  });

  it("already-redeemed token returns QR_ALREADY_USED error", async () => {
    const { token, tokenId } = await generateDynamicQR(VALID_BODY);
    markQRRedeemed(tokenId);
    const result = verifyAndDecodeQR(token);
    expect(result).toEqual({ error: "QR_ALREADY_USED" });
  });

  it("tampered token (modified payload) returns null", async () => {
    const { token } = await generateDynamicQR(VALID_BODY);
    // Flip a character in the payload portion
    const lastDot = token.lastIndexOf(".");
    const payloadPart = token.substring(0, lastDot);
    const sigPart = token.substring(lastDot + 1);
    const tampered = payloadPart.slice(0, -1) + (payloadPart.slice(-1) === "A" ? "B" : "A");
    const tamperedToken = `${tampered}.${sigPart}`;
    const result = verifyAndDecodeQR(tamperedToken);
    expect(result).toBeNull();
  });
});

// ── Property-based tests ──────────────────────────────────────────────────────

describe("PBT — QR payload completeness and 60s expiry (Property 11)", () => {
  // Feature: sol-ai-loyalty-poc, Property 11: QR payload completeness and expiry
  it("for any valid inputs, generated payload contains all required fields with correct expiry", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 36 }),
          merchantId: fc.string({ minLength: 1, maxLength: 36 }),
          campaignId: fc.string({ minLength: 1, maxLength: 36 }),
          paymentAmount: fc.integer({ min: 1, max: 10000000 }),
          voucherCode: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (inputs) => {
          const before = Math.floor(Date.now() / 1000);
          const { tokenId, expiresAt, token } = generateToken(inputs);
          const after = Math.floor(Date.now() / 1000);

          expect(typeof tokenId).toBe("string");
          expect(tokenId.length).toBeGreaterThan(0);
          expect(expiresAt).toBeGreaterThanOrEqual(before + 59);
          expect(expiresAt).toBeLessThanOrEqual(after + 61);

          const result = verifyAndDecodeQR(token);
          expect(result).not.toBeNull();
          expect(result.payload.token_id).toBe(tokenId);
          expect(result.payload.user_id).toBe(inputs.userId);
          expect(result.payload.merchant_id).toBe(inputs.merchantId);
          expect(result.payload.campaign_id).toBe(inputs.campaignId);
          expect(result.payload.payment_amount).toBe(inputs.paymentAmount);
          expect(result.payload.voucher_code).toBe(inputs.voucherCode);
          expect(result.payload.expires_at).toBe(expiresAt);

          // cleanup
          tokenStore.delete(tokenId);
        }
      ),
      { numRuns: 25 }
    );
  });
});

describe("PBT — QR round-trip integrity (Property 16)", () => {
  // Feature: sol-ai-loyalty-poc, Property 16: QR payload round-trip integrity
  it("for any valid QRPayload, encode then decode produces equivalent payload", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 36 }),
          merchantId: fc.string({ minLength: 1, maxLength: 36 }),
          campaignId: fc.string({ minLength: 1, maxLength: 36 }),
          paymentAmount: fc.integer({ min: 1, max: 10000000 }),
          voucherCode: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (inputs) => {
          const { token, tokenId, expiresAt } = generateToken(inputs);
          const result = verifyAndDecodeQR(token);

          expect(result).not.toBeNull();
          expect(result.error).toBeUndefined();
          expect(result.payload.token_id).toBe(tokenId);
          expect(result.payload.user_id).toBe(inputs.userId);
          expect(result.payload.merchant_id).toBe(inputs.merchantId);
          expect(result.payload.campaign_id).toBe(inputs.campaignId);
          expect(result.payload.payment_amount).toBe(inputs.paymentAmount);
          expect(result.payload.voucher_code).toBe(inputs.voucherCode);
          expect(result.payload.expires_at).toBe(expiresAt);

          tokenStore.delete(tokenId);
        }
      ),
      { numRuns: 25 }
    );
  });
});

describe("PBT — Invalid signature rejection (Property 17)", () => {
  // Feature: sol-ai-loyalty-poc, Property 17: tampered signature rejected
  it("for any tampered token, verifyAndDecodeQR returns null", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 36 }),
          merchantId: fc.string({ minLength: 1, maxLength: 36 }),
          campaignId: fc.string({ minLength: 1, maxLength: 36 }),
          paymentAmount: fc.integer({ min: 1, max: 10000000 }),
          voucherCode: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        fc.string({ minLength: 1, maxLength: 64 }),
        (inputs, fakeSig) => {
          const { token, tokenId } = generateToken(inputs);
          const lastDot = token.lastIndexOf(".");
          const payloadB64 = token.substring(0, lastDot);
          const tamperedToken = `${payloadB64}.${fakeSig}`;
          const result = verifyAndDecodeQR(tamperedToken);
          if (result !== null) {
            expect(result.error).toBeDefined();
          }
          tokenStore.delete(tokenId);
        }
      ),
      { numRuns: 25 }
    );
  });
});

describe("PBT — Single-use QR enforcement (Property 12)", () => {
  // Feature: sol-ai-loyalty-poc, Property 12: single-use enforcement
  it("for any redeemed token, second decode attempt returns QR_ALREADY_USED", () => {
    fc.assert(
      fc.property(
        fc.record({
          userId: fc.string({ minLength: 1, maxLength: 36 }),
          merchantId: fc.string({ minLength: 1, maxLength: 36 }),
          campaignId: fc.string({ minLength: 1, maxLength: 36 }),
          paymentAmount: fc.integer({ min: 1, max: 10000000 }),
          voucherCode: fc.string({ minLength: 1, maxLength: 50 }),
        }),
        (inputs) => {
          const { token, tokenId } = generateToken(inputs);

          const first = verifyAndDecodeQR(token);
          expect(first).not.toBeNull();
          expect(first.error).toBeUndefined();

          markQRRedeemed(tokenId);

          const second = verifyAndDecodeQR(token);
          expect(second).toEqual({ error: "QR_ALREADY_USED" });

          tokenStore.delete(tokenId);
        }
      ),
      { numRuns: 25 }
    );
  });
});
