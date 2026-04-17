/**
 * paiEasClient.js
 * Mock PAI-EAS propensity scoring client.
 *
 * In production: replace scoreOffers with a real PAI-EAS call:
 *   POST https://<endpoint>.pai-eas.aliyuncs.com/api/predict/<service_name>
 *   Headers: { Authorization: "<PAI_EAS_TOKEN>", "Content-Type": "application/json" }
 *   Body: { user_embedding: float[], campaign_embeddings: [{id, embedding}] }
 *
 * The Python scoring script (pai_eas_scorer.py) is the deployable version of this logic.
 */

const { normalize, EMBEDDING_DIM } = require("./dashVectorClient");

/**
 * Compute cosine similarity between two unit-normalized vectors.
 * Since both are normalized, cosine similarity = dot product.
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in [-1, 1]
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new Error("Vector dimension mismatch");
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot;
}

/**
 * Map cosine similarity from [-1, 1] to [0, 1].
 * @param {number} sim
 * @returns {number}
 */
function normalizeScore(sim) {
  return (sim + 1) / 2;
}

/**
 * Derive a deterministic campaign embedding from its metadata.
 * Uses a seeded approach based on merchant_id + discount_type.
 * @param {object} campaign
 * @returns {number[]}
 */
function getCampaignEmbedding(campaign) {
  // Simple deterministic embedding: hash campaign fields into a seed
  const seed = hashString(`${campaign.merchant_id}:${campaign.discount_type}:${campaign.discount_value}`);
  const rng = seededRng(seed);
  const raw = Array.from({ length: EMBEDDING_DIM }, () => rng());
  return normalize(raw);
}

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return u * 2 - 1;
  };
}

/**
 * Score a list of campaigns against a user embedding.
 * Mimics the PAI-EAS scoring endpoint response.
 *
 * @param {number[]} userEmbedding - 256-dim unit-normalized vector
 * @param {object[]} campaigns - array of Campaign objects from seed data
 * @returns {Promise<Array<{ campaign_id: string, score: number }>>} sorted descending
 */
async function scoreOffers(userEmbedding, campaigns) {
  // In production this would be:
  // const campaignEmbeddings = campaigns.map(c => ({ id: c.id, embedding: getCampaignEmbedding(c) }));
  // const response = await fetch(process.env.PAI_EAS_ENDPOINT, {
  //   method: "POST",
  //   headers: { Authorization: process.env.PAI_EAS_TOKEN, "Content-Type": "application/json" },
  //   body: JSON.stringify({ user_embedding: userEmbedding, campaign_embeddings: campaignEmbeddings }),
  // });
  // return response.json();

  const scores = campaigns.map((campaign) => {
    const campaignEmbedding = getCampaignEmbedding(campaign);
    const sim = cosineSimilarity(userEmbedding, campaignEmbedding);
    const rawScore = normalizeScore(sim); // [0, 1]
    // Remap to [0.80, 0.98] range for demo — all offers show high AI match
    const score = 0.80 + rawScore * 0.18;
    return { campaign_id: campaign.id, score: Math.round(score * 10000) / 10000 };
  });

  // Sort descending by score
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

module.exports = { scoreOffers, cosineSimilarity, normalizeScore, getCampaignEmbedding };
