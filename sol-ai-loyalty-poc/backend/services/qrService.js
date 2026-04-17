/**
 * QR Service — Dynamic QR generation, verification, and redemption tracking.
 * Mocks Alibaba Cloud Function Compute for the POC.
 * Uses HMAC-SHA256 signed tokens and an in-memory store (mock PolarDB).
 */

const crypto = require("crypto");
const QRCode = require("qrcode");

// Use built-in crypto.randomUUID() (Node 14.17+) — avoids ESM issues with uuid package
const uuidv4 = () => crypto.randomUUID();

const SECRET = process.env.QR_SECRET || "dev-secret-do-not-use-in-prod";

/**
 * In-memory token store — replaces PolarDB qr_tokens table for POC.
 * @type {Map<string, { redeemed: boolean, expiresAt: number }>}
 */
const tokenStore = new Map();

/**
 * Base64url-encode a string (no padding).
 * @param {string} str
 * @returns {string}
 */
function base64url(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Compute HMAC-SHA256 hex digest.
 * @param {string} data
 * @returns {string}
 */
function hmac(data) {
  return crypto.createHmac("sha256", SECRET).update(data).digest("hex");
}

/**
 * Generate a signed token (no image). Used by PBT tests and internally.
 * Synchronous and fast — no PNG rendering.
 *
 * @param {{ userId: string, merchantId: string, campaignId: string, paymentAmount: number, voucherCode: string }} payload
 * @returns {{ tokenId: string, expiresAt: number, token: string }}
 */
function generateToken({ userId, merchantId, campaignId, paymentAmount, voucherCode }) {
  const tokenId = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + 60;

  const qrPayload = {
    token_id: tokenId,
    user_id: userId,
    merchant_id: merchantId,
    campaign_id: campaignId,
    payment_amount: paymentAmount,
    voucher_code: voucherCode,
    expires_at: expiresAt,
  };

  const payloadB64 = base64url(JSON.stringify(qrPayload));
  const signature = hmac(payloadB64);
  const token = `${payloadB64}.${signature}`;

  tokenStore.set(tokenId, { redeemed: false, expiresAt });

  return { tokenId, expiresAt, token };
}

/**
 * Generate a Dynamic QR token and PNG image.
 * Use generateToken() directly in tests to avoid the PNG rendering cost.
 *
 * @param {{ userId: string, merchantId: string, campaignId: string, paymentAmount: number, voucherCode: string }} payload
 * @returns {Promise<{ tokenId: string, qrImageBase64: string, expiresAt: number, token: string }>}
 */
async function generateDynamicQR(payload) {
  const { tokenId, expiresAt, token } = generateToken(payload);
  const qrImageBase64 = await QRCode.toDataURL(token);
  return { tokenId, qrImageBase64, expiresAt, token };
}

/**
 * Verify and decode a signed QR token.
 *
 * @param {string} token
 * @returns {{ payload: object } | { error: string } | null}
 */
function verifyAndDecodeQR(token) {
  const lastDot = token.lastIndexOf(".");
  if (lastDot === -1) return null;

  const payloadB64 = token.substring(0, lastDot);
  const signature = token.substring(lastDot + 1);

  // Verify HMAC signature
  const expectedSig = hmac(payloadB64);
  if (signature !== expectedSig) return null;

  // Decode payload
  let qrPayload;
  try {
    qrPayload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf8"));
  } catch {
    return null;
  }

  // Check expiry
  if (qrPayload.expires_at < Math.floor(Date.now() / 1000)) {
    return { error: "QR_EXPIRED" };
  }

  // Check single-use
  const stored = tokenStore.get(qrPayload.token_id);
  if (stored?.redeemed) {
    return { error: "QR_ALREADY_USED" };
  }

  return { payload: qrPayload };
}

/**
 * Mark a QR token as redeemed (single-use enforcement).
 * @param {string} tokenId
 */
function markQRRedeemed(tokenId) {
  const entry = tokenStore.get(tokenId);
  if (entry) {
    entry.redeemed = true;
  }
}

module.exports = { generateDynamicQR, generateToken, verifyAndDecodeQR, markQRRedeemed, tokenStore };
