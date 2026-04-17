/**
 * dashVectorClient.js
 * Mock DashVector client — returns seeded 256-dim user embeddings.
 *
 * In production: replace getUserEmbedding with a real DashVector query:
 *   POST https://<instance>.dashvector.aliyuncs.com/v1/collections/<col>/query
 *   Headers: { Authorization: "Bearer <DASHVECTOR_API_KEY>" }
 *   Body: { vector: null, filter: `id = '${userId}'`, topk: 1 }
 */

const EMBEDDING_DIM = 256;

/**
 * Seeded pseudo-random number generator (mulberry32).
 * Produces deterministic floats in [-1, 1] for a given seed.
 * @param {number} seed
 * @returns {() => number}
 */
function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    const u = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    return u * 2 - 1; // [-1, 1]
  };
}

/**
 * Convert a userId string to a numeric seed.
 * @param {string} userId
 * @returns {number}
 */
function userIdToSeed(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (Math.imul(31, hash) + userId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Normalize a vector to unit length.
 * @param {number[]} vec
 * @returns {number[]}
 */
function normalize(vec) {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

/**
 * Returns a mock 256-dim unit-normalized embedding for a user.
 * Different userIds produce meaningfully different vectors.
 *
 * @param {string} userId
 * @returns {Promise<{ vector: number[], fields: object }>}
 */
async function getUserEmbedding(userId) {
  // In production this would be:
  // const response = await fetch(`${process.env.DASHVECTOR_ENDPOINT}/v1/collections/user-embeddings/query`, {
  //   method: "POST",
  //   headers: { Authorization: `Bearer ${process.env.DASHVECTOR_API_KEY}`, "Content-Type": "application/json" },
  //   body: JSON.stringify({ filter: `id = '${userId}'`, topk: 1 }),
  // });
  // const data = await response.json();
  // return data.output.docs[0];

  const rng = seededRng(userIdToSeed(userId));
  const raw = Array.from({ length: EMBEDDING_DIM }, () => rng());
  const vector = normalize(raw);

  return {
    id: userId,
    vector,
    fields: {
      top_categories: ["dining", "coffee", "retail"],
      avg_monthly_spend: 3000000,
      last_updated: new Date().toISOString(),
    },
  };
}

module.exports = { getUserEmbedding, normalize, EMBEDDING_DIM };
