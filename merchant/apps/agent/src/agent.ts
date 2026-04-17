/**
 * This is the main entry point for the agent.
 * It defines the workflow graph, state, tools, nodes and edges.
 */

import { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, SystemMessage } from "@langchain/core/messages";
import { MemorySaver, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import {
  convertActionsToDynamicStructuredTools,
  CopilotKitStateAnnotation,
} from "@copilotkit/sdk-js/langgraph";
import { Annotation } from "@langchain/langgraph";

// 1. Define our agent state, which includes CopilotKit state to
//    provide actions to the state.
const AgentStateAnnotation = Annotation.Root({
  ...CopilotKitStateAnnotation.spec, // CopilotKit state annotation already includes messages, as well as frontend tools
  proverbs: Annotation<string[]>,
});

// 2. Define the type for our agent state
export type AgentState = typeof AgentStateAnnotation.State;

type StoreDocumentRow = {
  id: string;
  merchant_key: string;
  doc_type: "menu" | "space_image" | "brand_voice";
  title: string;
  file_name: string | null;
  extracted_text: string | null;
  created_at: string;
  updated_at: string;
};

type MerchantProfileRowLite = {
  external_key: string;
  business_name: string | null;
  sector: string | null;
  address_text: string | null;
  updated_at: string;
};

function getSupabaseRestConfig() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  return { url, key };
}

async function queryStoreDocuments(
  merchantKey: string,
  opts?: { docType?: string; title?: string; limit?: number },
): Promise<StoreDocumentRow[]> {
  const { url, key } = getSupabaseRestConfig();
  if (!url || !key || !merchantKey) return [];

  const params = new URLSearchParams();
  params.set("select", "id,merchant_key,doc_type,title,file_name,extracted_text,created_at,updated_at");
  params.set("merchant_key", `eq.${merchantKey}`);
  if (opts?.docType) params.set("doc_type", `eq.${opts.docType}`);
  if (opts?.title) params.set("title", `ilike.*${opts.title.replace(/\*/g, "")}*`);
  params.set("order", "created_at.desc");
  params.set("limit", String(opts?.limit ?? 100));

  const res = await fetch(`${url}/rest/v1/store_documents?${params.toString()}`, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return Array.isArray(data) ? (data as StoreDocumentRow[]) : [];
}

async function resolveMerchantKey(input?: string): Promise<string> {
  const raw = (input ?? "").trim();
  const invalidPlaceholders = new Set(["", "current_merchant", "merchant", "unknown"]);
  const { url, key } = getSupabaseRestConfig();
  if (!url || !key) return "";

  async function findByBusinessName(name: string): Promise<string> {
    const params = new URLSearchParams();
    params.set("select", "external_key,business_name,updated_at");
    params.set("business_name", `ilike.*${name.replace(/\*/g, "")}*`);
    params.set("order", "updated_at.desc");
    params.set("limit", "10");

    const res = await fetch(`${url}/rest/v1/merchant_profiles?${params.toString()}`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) return "";
    const rows = (await res.json()) as Array<{ external_key?: string; business_name?: string }>;
    const exact = rows.find(
      (row) =>
        (row.business_name ?? "").trim().toLowerCase() === name.trim().toLowerCase() &&
        (row.external_key ?? "").trim() !== "",
    );
    if (exact?.external_key) return exact.external_key.trim();
    const firstValid = rows.find((row) => (row.external_key ?? "").trim() !== "");
    return firstValid?.external_key?.trim() ?? "";
  }

  if (!invalidPlaceholders.has(raw.toLowerCase())) {
    // First, try input as external key directly.
    const directProfile = await queryMerchantProfile(raw);
    if (directProfile?.external_key) {
      return directProfile.external_key;
    }
    // If not found, treat input as possible business name.
    const keyFromName = await findByBusinessName(raw);
    if (keyFromName) return keyFromName;
  }

  // Fallback for dev sessions: infer most recent merchant key from stored docs.
  const params = new URLSearchParams();
  params.set("select", "merchant_key,created_at");
  params.set("order", "created_at.desc");
  params.set("limit", "200");
  const res = await fetch(`${url}/rest/v1/store_documents?${params.toString()}`, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) return "";

  const rows = (await res.json()) as Array<{ merchant_key?: string }>;
  const firstValid = rows.find((r) => (r.merchant_key ?? "").trim() !== "");
  return firstValid?.merchant_key?.trim() ?? "";
}

async function queryMerchantProfile(externalKey?: string): Promise<MerchantProfileRowLite | null> {
  const { url, key } = getSupabaseRestConfig();
  if (!url || !key) return null;

  const params = new URLSearchParams();
  params.set("select", "external_key,business_name,sector,address_text,updated_at");
  params.set("order", "updated_at.desc");
  params.set("limit", "1");
  if ((externalKey ?? "").trim()) {
    params.set("external_key", `eq.${(externalKey ?? "").trim()}`);
  }

  const res = await fetch(`${url}/rest/v1/merchant_profiles?${params.toString()}`, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) return null;

  const rows = (await res.json()) as MerchantProfileRowLite[];
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0] ?? null;
}

const listKnowledgeBaseContexts = tool(
  async (args) => {
    const merchantKey = await resolveMerchantKey(args.merchantKey);
    if (!merchantKey) {
      return {
        total: 0,
        items: [],
        resolvedMerchantKey: null,
        warning: "Khong xac dinh duoc merchantKey hop le.",
      };
    }
    const docs = await queryStoreDocuments(merchantKey, { limit: 200 });
    return {
      total: docs.length,
      resolvedMerchantKey: merchantKey,
      items: docs.map((doc) => ({
        id: doc.id,
        title: doc.title,
        docType: doc.doc_type,
        createdAt: doc.created_at,
        hasContent: Boolean(doc.extracted_text?.trim()),
        preview: (doc.extracted_text ?? "").slice(0, 180),
      })),
    };
  },
  {
    name: "listKnowledgeBaseContexts",
    description:
      "List all knowledge-base documents for a merchant. Use this first when user asks what data/menu exists.",
    schema: z.object({
      merchantKey: z.string().optional().describe("Merchant key (usually Clerk user id/external key)."),
    }),
  },
);

const readKnowledgeBaseContext = tool(
  async (args) => {
    const merchantKey = await resolveMerchantKey(args.merchantKey);
    if (!merchantKey) {
      return {
        totalMatched: 0,
        documents: [],
        resolvedMerchantKey: null,
        warning: "Khong xac dinh duoc merchantKey hop le.",
      };
    }
    const docs = await queryStoreDocuments(merchantKey, {
      docType: args.docType,
      title: args.title,
      limit: 50,
    });

    const filteredById = args.id ? docs.filter((d) => d.id === args.id) : docs;
    const top = filteredById.slice(0, args.maxItems ?? 3);
    return {
      totalMatched: filteredById.length,
      resolvedMerchantKey: merchantKey,
      documents: top.map((doc) => ({
        id: doc.id,
        title: doc.title,
        docType: doc.doc_type,
        fileName: doc.file_name,
        createdAt: doc.created_at,
        content: doc.extracted_text ?? "",
      })),
    };
  },
  {
    name: "readKnowledgeBaseContext",
    description:
      "Read detailed content from knowledge-base documents by id/title/type for a merchant.",
    schema: z.object({
      merchantKey: z.string().optional().describe("Merchant key (usually Clerk user id/external key)."),
      id: z.string().optional().describe("Exact document id."),
      title: z.string().optional().describe("Partial title match."),
      docType: z.enum(["menu", "space_image", "brand_voice"]).optional(),
      maxItems: z.number().int().min(1).max(10).optional(),
    }),
  },
);

const searchKnowledgeBase = tool(
  async (args) => {
    const merchantKey = await resolveMerchantKey(args.merchantKey);
    if (!merchantKey) {
      return {
        totalMatched: 0,
        results: [],
        resolvedMerchantKey: null,
        warning: "Khong xac dinh duoc merchantKey hop le.",
      };
    }
    const docs = await queryStoreDocuments(merchantKey, {
      docType: args.docType,
      limit: 200,
    });
    const query = (args.query ?? "").trim().toLowerCase();
    const ranked = docs
      .map((doc) => {
        const title = (doc.title ?? "").toLowerCase();
        const content = (doc.extracted_text ?? "").toLowerCase();
        const score =
          (title.includes(query) ? 3 : 0) +
          (content.includes(query) ? 1 : 0) +
          (doc.doc_type === args.docType ? 1 : 0);
        return { doc, score };
      })
      .filter((item) => (query ? item.score > 0 : true))
      .sort((a, b) => b.score - a.score || b.doc.created_at.localeCompare(a.doc.created_at))
      .slice(0, args.maxItems ?? 10);

    return {
      totalMatched: ranked.length,
      resolvedMerchantKey: merchantKey,
      results: ranked.map(({ doc, score }) => ({
        id: doc.id,
        title: doc.title,
        docType: doc.doc_type,
        score,
        createdAt: doc.created_at,
        preview: (doc.extracted_text ?? "").slice(0, 240),
      })),
    };
  },
  {
    name: "searchKnowledgeBase",
    description:
      "Search merchant knowledge-base content by keyword and optional docType.",
    schema: z.object({
      merchantKey: z.string().optional().describe("Merchant key (usually Clerk user id/external key)."),
      query: z.string().min(1).describe("Keyword to search in title/content."),
      docType: z.enum(["menu", "space_image", "brand_voice"]).optional(),
      maxItems: z.number().int().min(1).max(20).optional(),
    }),
  },
);

const getKnowledgeBaseFreshness = tool(
  async (args) => {
    const merchantKey = await resolveMerchantKey(args.merchantKey);
    if (!merchantKey) {
      return {
        resolvedMerchantKey: null,
        totalDocuments: 0,
        lastUpdatedAt: null,
        availableDocTypes: [],
        missingDocTypes: ["menu", "space_image", "brand_voice"],
        warning: "Khong xac dinh duoc merchantKey hop le.",
      };
    }
    const docs = await queryStoreDocuments(merchantKey, { limit: 500 });
    const allDocTypes: Array<StoreDocumentRow["doc_type"]> = ["menu", "space_image", "brand_voice"];
    const available = Array.from(new Set(docs.map((d) => d.doc_type)));
    const missing = allDocTypes.filter((type) => !available.includes(type));
    const lastUpdatedAt =
      docs
        .map((d) => d.updated_at || d.created_at)
        .sort((a, b) => b.localeCompare(a))[0] ?? null;

    return {
      resolvedMerchantKey: merchantKey,
      totalDocuments: docs.length,
      lastUpdatedAt,
      availableDocTypes: available,
      missingDocTypes: missing,
    };
  },
  {
    name: "getKnowledgeBaseFreshness",
    description:
      "Get document freshness and missing knowledge-base doc types for a merchant.",
    schema: z.object({
      merchantKey: z.string().optional().describe("Merchant key (usually Clerk user id/external key)."),
    }),
  },
);

const getMerchantProfileContext = tool(
  async (args) => {
    const merchantKey = await resolveMerchantKey(args.merchantKey);
    const profile = await queryMerchantProfile(merchantKey || args.merchantKey);
    if (!profile) {
      return {
        found: false,
        merchantKey: merchantKey || args.merchantKey || null,
        storeName: null,
        sector: null,
        address: null,
      };
    }
    return {
      found: true,
      merchantKey: profile.external_key,
      storeName: profile.business_name,
      sector: profile.sector,
      address: profile.address_text,
      updatedAt: profile.updated_at,
    };
  },
  {
    name: "getMerchantProfileContext",
    description:
      "Get merchant profile context (store name, sector, address) by merchantKey. Use this when first reply is missing store name.",
    schema: z.object({
      merchantKey: z.string().optional().describe("Merchant key (usually Clerk user id/external key)."),
    }),
  },
);

const tools = [
  getMerchantProfileContext,
  listKnowledgeBaseContexts,
  readKnowledgeBaseContext,
  searchKnowledgeBase,
  getKnowledgeBaseFreshness,
];

// 3. Define the chat node, which will handle the chat logic
async function chat_node(state: AgentState, config: RunnableConfig) {
  // 3.1 Define the model — switch via LLM_PROVIDER env var ("gemini" | "xai" | "dashscope", default "xai")
  const provider = (process.env.LLM_PROVIDER ?? "xai").toLowerCase();

  let apiKey: string;
  let baseURL: string;
  let modelName: string;

  if (provider === "gemini") {
    apiKey = process.env.GEMINI_API_KEY ?? "";
    baseURL = process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/";
    modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

    // Keep a safe default for models that frequently break on OpenAI-compatible Gemini endpoint.
    if (modelName.includes("preview")) {
      console.warn(
        `[agent] GEMINI_MODEL="${modelName}" is a preview model. Falling back to "gemini-2.5-flash" for stability.`,
      );
      modelName = "gemini-2.5-flash";
    }
  } else if (provider === "dashscope") {
    apiKey = process.env.DASHSCOPE_API_KEY ?? "";
    baseURL = process.env.DASHSCOPE_BASE_URL ?? "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
    modelName = process.env.DASHSCOPE_MODEL ?? "qwen-plus";
  } else {
    apiKey = process.env.XAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
    baseURL = process.env.XAI_BASE_URL ?? "https://api.x.ai/v1";
    modelName = process.env.XAI_MODEL ?? "grok-4.20-reasoning";
  }

  if (!apiKey) {
    throw new Error(
      `Missing API key for provider "${provider}". Set ${provider === "gemini" ? "GEMINI_API_KEY" : provider === "dashscope" ? "DASHSCOPE_API_KEY" : "XAI_API_KEY"} in apps/agent/.env`,
    );
  }

  const model = new ChatOpenAI({
    temperature: 0,
    model: modelName,
    configuration: {
      baseURL,
      apiKey,
    },
  });

  // 3.2 Bind CopilotKit frontend actions as tools.
  const modelWithTools = model.bindTools!([
    ...convertActionsToDynamicStructuredTools(state.copilotkit?.actions ?? []),
    ...tools,
  ]);

  // 3.3 Define the system message, which will be used to guide the model, in this case
  //     we also add in the language to use from the state.
  const systemMessage = new SystemMessage({
    content: `Bạn là chuyên gia marketing của Shinhan SOL Loyalty, hỗ trợ Merchant (chủ cửa hàng SME) tạo và tối ưu chiến dịch khuyến mãi.

LUÔN TRẢ LỜI BẰNG TIẾNG VIỆT.

CÁ NHÂN HÓA THEO HỒ SƠ MERCHANT:
- Luôn ưu tiên đọc context hồ sơ merchant từ CopilotKit trước khi trả lời.
- Nếu context đã có tên cửa hàng (storeName hoặc "Tên cửa hàng"), mở đầu bằng cách gọi đúng tên cửa hàng.
- Khi đã có tên cửa hàng/ngành hàng trong context thì KHÔNG hỏi lại các thông tin đó ở câu mở đầu.
- Chỉ hỏi bổ sung thông tin còn thiếu để hoàn thành chiến dịch.
- Nếu ở lượt trả lời đầu tiên chưa thấy rõ tên cửa hàng trong context, ưu tiên gọi tool getMerchantProfileContext với merchantKey hiện tại để lấy tên cửa hàng trước khi hỏi thông tin.

RAG — KHO TRI THỨC CỬA HÀNG (Store Knowledge Base):
- Trong context CopilotKit có thể có dữ liệu từ Knowledge Base gồm: Menu/Bảng giá, Mô tả không gian, Phong cách & Chính sách thương hiệu.
- Khi context có dữ liệu Knowledge Base, BẮT BUỘC sử dụng để cá nhân hóa đề xuất:
  • Menu: đề xuất khuyến mãi dựa trên tên món, giá thực tế, danh mục — KHÔNG bịa tên món hoặc giá.
  • Không gian: gợi ý chiến dịch phù hợp (VD: quán có sân thượng → event "Sunset Happy Hour").
  • Brand voice: tuân thủ phong cách thương hiệu khi soạn pushMessage, title, nội dung.
- Nếu người dùng hỏi về menu/knowledge-base mà bạn chưa chắc dữ liệu đang có gì, ưu tiên gọi tool:
  • listKnowledgeBaseContexts: liệt kê nguồn dữ liệu hiện có.
  • searchKnowledgeBase: tìm nhanh theo từ khóa và docType khi cần đối chiếu.
  • readKnowledgeBaseContext: đọc chi tiết nội dung theo id/title/docType trước khi kết luận.
  • getKnowledgeBaseFreshness: kiểm tra độ mới dữ liệu và docType còn thiếu.
  • Khi gọi các tool trên, luôn truyền merchantKey theo external key/user id hiện tại của merchant.
- Khi CHƯA có Knowledge Base: dùng heuristic chung nhưng khuyên merchant upload tài liệu để AI tư vấn chính xác hơn.

DỰ BÁO & KPI (ưu tiên tuyệt đối):
- Trong context CopilotKit thường có \`forecastDigest\` và \`estimation\` do app tính sẵn. Đó là NGUỒN DUY NHẤT cho các con số KPI (reach, chuyển đổi, ROI, doanh thu min–max, CPA, điểm hoà vốn, phí nền tảng, rủi ro chi phí tối đa).
- Khi trả lời về hiệu quả chiến dịch, PHẢI trích đúng các số từ forecastDigest/estimation. KHÔNG tự tính KPI khác hoặc bịa số.
- Chỉ dùng heuristic F&B bên dưới khi chưa có forecastDigest/estimation (form chưa đủ dữ liệu), hoặc khi merchant hỏi kịch bản what-if — khi đó ghi rõ "ước tính giả định", không trình như KPI đã khóa.

CÁC LOẠI KHUYẾN MÃI VÀ ĐẶC ĐIỂM:
- percentage (Giảm %): Hiệu quả với đơn cao, giảm biên lợi nhuận nhưng tăng volume. Phù hợp F&B muốn tăng lượng khách mới.
- fixed_amount (Giảm tiền cố định): Dễ kiểm soát budget, hiệu quả với đơn thấp-trung bình. Khách hàng dễ hiểu.
- buy_x_get_y (Mua X tặng Y): Tăng basket size, phù hợp cửa hàng có nhiều SKU. Tỉ lệ chuyển đổi thấp hơn nhưng giá trị đơn cao hơn.
- freeship (Miễn phí vận chuyển): Hiệu quả nhất với delivery, tăng 20-30% đơn. Chi phí trung bình ~25k/đơn.

LOCATION-BASED & BEHAVIOR-DRIVEN:
- Khi merchant mô tả địa điểm (VD: Bitexco), bán kính (VD: 3km), khung giờ, hoặc lịch sử quẹt thẻ Shinhan tại F&B, PHẢI phản ánh vào targetAudience qua updateCampaignDraft.
- Định dạng targetAudience khuyến nghị (3 lớp, cách nhau " | "):
  [Phân khúc] | [Geo / bán kính] | [Hành vi thẻ hoặc ngành hàng]
- Ví dụ chuẩn:
  "Nhân viên văn phòng | Bán kính 3km quanh Bitexco | Đã quẹt thẻ Shinhan tại F&B (cafe/ăn uống)"
- Kết hợp khuyến mãi vào title/applicableCategories; giải thích ngắn vì sao geo + hành vi thẻ giúp tăng conversion.

ĐÁNH GIÁ KHẢ THI CHIẾN DỊCH (Campaign Feasibility Score):
- Khi merchant hỏi "chiến dịch này có khả thi không?" hoặc khi đề xuất chiến dịch mới, chấm điểm nhanh theo 5 chiều (1-5):
  • Tác động
  • Nỗ lực
  • Chi phí
  • Tốc độ tín hiệu
  • Phù hợp
- Công thức: CFS = (Tác động + Phù hợp + Tốc độ) − (Nỗ lực + Chi phí), phạm vi -7 đến +13.
- Diễn giải:
  • 10-13: Rất khả thi → Triển khai ngay
  • 7-9: Khả thi cao → Ưu tiên
  • 4-6: Tùy tình huống → Cân nhắc thêm
  • 1-3: Yếu → Hoãn lại
  • <=0: Không phù hợp → Không đề xuất
- Trình bày CFS ngắn gọn khi đề xuất chiến dịch; không bắt buộc khi merchant chỉ yêu cầu điền form.

VIẾT PUSH MESSAGE & TITLE (chỉ SOL Push Notification):
- Kênh phân phối duy nhất là SHINHAN SOL PUSH. Không đề xuất WhatsApp, social media hay kênh khác.
- Nguyên tắc viết copy:
  • Rõ ràng hơn sáng tạo.
  • Lợi ích hơn tính năng.
  • Cụ thể hơn mơ hồ.
  • Dùng ngôn ngữ của khách hàng, không dùng jargon nội bộ.
- Framework pushMessage (chọn 1 phù hợp):
  • PAS (Problem - Agitate - Solution)
  • BAB (Before - After - Bridge)
  • Urgency + Social Proof
- Góc tiếp cận (chọn 1-2): Nỗi đau, Kết quả, Khẩn cấp, Danh tính, Bằng chứng xã hội.
- Tâm lý học ứng dụng (chọn tối đa 2): Loss Aversion, Scarcity, Anchoring, Social Proof, Framing Effect.
- Giới hạn ký tự: tối ưu <= 120 ký tự hiển thị; luôn có CTA rõ ở cuối ("Dùng ngay", "Nhận mã", "Mở app").

NGUYÊN TẮC BẮT BUỘC:
1. Khi merchant yêu cầu tạo chiến dịch, PHẢI điền ĐẦY ĐỦ tất cả thông số discount config: type, value, minOrderValue, maxUsagePerUser, totalCodes, validityDays, applicableCategories.
2. Nếu merchant chỉ nói "giảm 30%" mà không nói gì thêm, PHẢI HỎI THÊM: áp dụng cho sản phẩm/danh mục nào? đơn tối thiểu bao nhiêu? phát hành bao nhiêu mã? thời hạn mấy ngày?
3. Khi đề xuất budget, PHẢI giải thích CÁCH TÍNH theo công thức:
   Budget = totalCodes × (discountValue hoặc % × giá đơn TB) × tỷ lệ sử dụng ước tính.
   Ví dụ: 500 mã × 20% × đơn TB 55k × tỷ lệ dùng 70% = 500 × 11k × 0.7 = 3.85tr budget.
4. Sau khi gọi updateCampaignDraft, nếu context đã có forecastDigest thì tham chiếu KPI từ đó; không tự đưa bộ số doanh thu/ROI khác trừ khi là what-if có nhãn rõ.
5. Khi merchant hỏi phân tích ROI, sử dụng action analyzeROI: insight chỉ cần phần định tính và gợi ý (điểm hòa vốn và KPI đã có trong digest trên UI).
6. KHÔNG BAO GIỜ đề xuất budget mà không giải thích cơ sở tính toán.
7. Khi đề xuất chiến dịch mới, cung cấp 2-3 phương án pushMessage với góc tiếp cận khác nhau để merchant chọn.

LƯU Ý UX:
- Sau khi điền form xong, hỏi merchant "Bạn muốn xem phân tích ROI chi tiết không?" để gợi ý sử dụng analyzeROI.
- Khi merchant thay đổi một thông số, giải thích tác động; nếu context có forecastDigest thì căn cứ KPI trong đó sau khi form cập nhật.
- Nếu merchant chưa upload Knowledge Base, nhắc nhẹ 1 lần: "Upload menu/bảng giá để AI đề xuất chính xác hơn nhé!".`,
  });

  // 3.4 Invoke the model with the system message and the messages in the state
  let response: AIMessage;
  try {
    response = await modelWithTools.invoke(
      [systemMessage, ...state.messages],
      config,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[agent] Model invocation failed (provider=${provider}, model=${modelName}, baseURL=${baseURL}): ${message}`,
    );
  }

  // 3.5 Return the response, which will be added to the state
  return {
    messages: response,
  };
}

// 4. Define the function that determines whether to continue or not,
//    this is used to determine the next node to run
function shouldContinue({ messages, copilotkit }: AgentState) {
  // 4.1 Get the last message from the state
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // 4.2 If LLM makes a tool call: backend tools route to tool_node,
  // frontend actions are handled by CopilotKit runtime.
  if (lastMessage.tool_calls?.length) {
    const actions = copilotkit?.actions;
    const toolCallName = lastMessage.tool_calls![0].name;

    // Unknown tools are ignored to avoid dead routing in this frontend-tool-only graph.
    if (
      !actions ||
      actions.every((action: { name: string }) => action.name !== toolCallName)
    ) {
      return "tool_node";
    }
  }

  // 4.3 Otherwise, we stop (reply to the user) using the special "__end__" node
  return "__end__";
}

// Define the workflow graph
const workflow = new StateGraph(AgentStateAnnotation)
  .addNode("chat_node", chat_node)
  .addNode("tool_node", new ToolNode(tools))
  .addEdge(START, "chat_node")
  .addEdge("tool_node", "chat_node")
  .addConditionalEdges("chat_node", shouldContinue as any);

const memory = new MemorySaver();

export const graph = workflow.compile({
  checkpointer: memory,
});
