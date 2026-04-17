/**
 * qwenClient.js — Qwen-Plus client for generating offer match explanations.
 *
 * Calls Alibaba Cloud Model Studio (DashScope International) API
 * using the OpenAI-compatible endpoint.
 */

const DASHSCOPE_URL =
  process.env.QWEN_BASE_URL ||
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";

const SYSTEM_PROMPT = `You are a personalization engine for Shinhan Bank's SOL loyalty app.
Respond ONLY with a single sentence in Vietnamese explaining why this specific offer matches the user.
Each explanation must be unique and specific to the offer and user's spending habits.
Do NOT use markdown. Do NOT add any prefix like "Explanation:" or "Answer:".
Keep it natural, friendly, and under 40 words.`;

/**
 * Generate a one-sentence Vietnamese explanation of why an offer matches a user.
 *
 * @param {string[]} userCategories  - User's top spending categories
 * @param {string}   targetDemographic - Campaign's target demographic string
 * @param {string}   [merchantName] - Merchant name for context
 * @param {string}   [promotionalCopy] - Campaign promotional copy for context
 * @returns {Promise<string>} A single Vietnamese sentence
 */
async function generateExplanation(userCategories, targetDemographic, merchantName, promotionalCopy) {
  const apiKey = process.env.QWEN_API_KEY;
  const model = process.env.QWEN_MODEL || "qwen-plus";

  if (!apiKey) {
    return buildMockExplanation(userCategories, targetDemographic, merchantName);
  }

  const userMessage = `User's top spending categories: ${userCategories.join(", ")}.
Offer from: ${merchantName || "a merchant"}.
Offer targets: ${targetDemographic}.
Offer details: ${promotionalCopy || "discount offer"}.
Write one unique Vietnamese sentence explaining why this specific offer is relevant to this user.`;

  const body = {
    model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    stream: false,
    enable_thinking: false,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${DASHSCOPE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Qwen API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content || typeof content !== "string") {
      throw new Error("Qwen response missing expected content field");
    }

    return content.trim();
  } catch (err) {
    console.error("[qwenClient] generateExplanation failed:", err.message);
    // Return varied fallback instead of throwing
    return buildMockExplanation(userCategories, targetDemographic, merchantName);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Build a varied mock explanation based on user categories and campaign info.
 * Each combination produces a different sentence.
 */
function buildMockExplanation(userCategories, targetDemographic, merchantName) {
  const cat = userCategories?.[0] ?? "mua sắm";
  const merchant = merchantName || "cửa hàng";
  const demo = targetDemographic || "";

  const templates = [
    `Bạn thường chi tiêu cho ${cat} — ưu đãi từ ${merchant} rất phù hợp với thói quen của bạn.`,
    `Dựa trên lịch sử giao dịch ${cat} gần đây, ${merchant} có chương trình giảm giá dành riêng cho bạn.`,
    `${merchant} đang có ưu đãi hấp dẫn, phù hợp với sở thích ${cat} của bạn trên SOL.`,
    `Vì bạn hay mua sắm trong danh mục ${cat}, chúng tôi nghĩ bạn sẽ thích ưu đãi này từ ${merchant}.`,
    `Ưu đãi này từ ${merchant} được gợi ý vì bạn thường xuyên chi tiêu cho ${cat} qua SOL.`,
    `AI nhận thấy bạn quan tâm đến ${cat} — ${merchant} đang có khuyến mãi đặc biệt cho bạn.`,
    `Với thói quen chi tiêu ${cat} của bạn, ưu đãi từ ${merchant} sẽ giúp bạn tiết kiệm đáng kể.`,
    `Bạn nằm trong nhóm khách hàng yêu thích ${cat} — ${merchant} muốn tri ân bạn với ưu đãi này.`,
  ];

  // Pick template based on a simple hash of the inputs for consistency
  const hash = (cat + merchant + demo).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return templates[hash % templates.length];
}

module.exports = { generateExplanation };
