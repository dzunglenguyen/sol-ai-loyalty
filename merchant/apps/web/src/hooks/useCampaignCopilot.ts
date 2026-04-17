import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import type { Dispatch, SetStateAction } from "react";
import { INITIAL_DRAFT } from "@/lib/merchant-campaign/constants";
import type {
  BudgetEstimation,
  CampaignDraft,
  DiscountType,
} from "@/lib/merchant-campaign/types";
import { calculateEstimation } from "@/utils/estimationEngine";
import { copilotReadableMerchantBlock } from "@/lib/demoMerchant";
import type { MerchantProfileRow } from "@/lib/supabase/tables";

export function useCampaignCopilot({
  draft,
  setDraft,
  estimation,
  forecastDigest,
  triggerFlash,
  onPublished,
  onResetCampaign,
  merchantProfile,
}: {
  draft: CampaignDraft;
  setDraft: Dispatch<SetStateAction<CampaignDraft>>;
  estimation: BudgetEstimation | null;
  /** Bản tóm KPI chuẩn (tiếng Việt) — trùng với UI; model phải dùng số từ đây. */
  forecastDigest: string | null;
  triggerFlash: (fieldNames: string[]) => void;
  /** Gọi sau khi AI publish — ví dụ đồng bộ Supabase. */
  onPublished?: (next: CampaignDraft) => void;
  /** Gọi khi AI reset chiến dịch — xóa id Supabase local. */
  onResetCampaign?: () => void;
  merchantProfile: MerchantProfileRow | null;
}) {
  const merchantContext = {
    merchantKey: merchantProfile?.external_key ?? null,
    storeName: merchantProfile?.business_name?.trim() || null,
    sector: merchantProfile?.sector?.trim() || null,
    address: merchantProfile?.address_text?.trim() || null,
  };

  useCopilotReadable({
    description:
      "Ngữ cảnh merchant thực tế từ hồ sơ cửa hàng. Dùng để cá nhân hóa đề xuất chiến dịch theo ngành và vị trí.",
    value: copilotReadableMerchantBlock(merchantProfile),
  });

  useCopilotReadable({
    description:
      "Hồ sơ merchant dạng structured để AI dùng trực tiếp. Nếu đã có storeName thì xưng hô theo tên cửa hàng và KHÔNG hỏi lại tên cửa hàng/ngành hàng ở câu mở đầu.",
    value: merchantContext,
  });

  useCopilotReadable({
    description: `Trạng thái chiến dịch ưu đãi của merchant.
Bao gồm:
- title: tên chiến dịch
- targetAudience: đối tượng mục tiêu — ưu tiên định dạng location-based & hành vi khi user nhắc địa điểm/geo/hạn mức thẻ (xem mô tả action updateCampaignDraft)
- discount: object cấu trúc gồm type (percentage|fixed_amount|buy_x_get_y|freeship), value (giá trị giảm), minOrderValue (đơn tối thiểu VND), maxUsagePerUser (giới hạn/người), totalCodes (tổng mã phát hành), validityDays (hiệu lực ngày), applicableCategories (danh mục)
- budget: ngân sách VND
- pushMessage: tin nhắn push notification
- status: idle/drafting/published
- estimation: object KPI (reach, conversion, revenue min–max, ROI, CPA, breakeven) — đồng bộ với UI
- forecastDigest: bản tóm KPI tiếng Việt do engine tính (ưu tiên đọc khối này)
- aiInsight: phân tích sâu của AI (nếu có)

QUY TẮC KPI: Mọi con số dự báo (reach, chuyển đổi, ROI, doanh thu, CPA, điểm hoà vốn, phí nền tảng, rủi ro chi phí tối đa) CHỈ được trích từ forecastDigest và estimation. KHÔNG tự tính KPI khác hoặc bịa số. Nếu cần kịch bản giả định (what-if), phải ghi rõ là ước tính thủ công, tách khỏi KPI chính thức.`,
    value: { ...draft, estimation, forecastDigest },
  });

  useCopilotAction({
    name: "updateCampaignDraft",
    description: `Cập nhật các thông số chiến dịch ưu đãi. Khi merchant yêu cầu tạo chiến dịch, hãy điền ĐẦY ĐỦ tất cả các trường bao gồm cả discount config chi tiết.
LOCATION-BASED & BEHAVIOR (bắt buộc khi user nhắc địa điểm / bán kính / lịch sử quẹt thẻ):
- Điền targetAudience theo 3 lớp, cách nhau bằng " | ":
  (1) Phân khúc nhân khẩu — VD: "Nhân viên văn phòng"
  (2) Geo — VD: "Bán kính 3km quanh Bitexco"
  (3) Hành vi thẻ — VD: "Đã quẹt thẻ Shinhan tại F&B (cafe/ăn uống)"
- Ví dụ đầy đủ: "Nhân viên văn phòng | Bán kính 3km quanh Bitexco | Đã quẹt thẻ Shinhan tại F&B (cafe/ăn uống)"
Khi merchant chỉ nói "giảm 30%" mà không nói gì thêm, hãy HỎI THÊM: áp dụng cho sản phẩm nào, đơn tối thiểu bao nhiêu, phát bao nhiêu mã.
QUAN TRỌNG: Luôn giải thích lý do chọn budget dựa trên các thông số discount đã thiết lập.`,
    parameters: [
      { name: "title", type: "string", description: "Tên chiến dịch ưu đãi", required: false },
      {
        name: "targetAudience",
        type: "string",
        description:
          "Đối tượng mục tiêu. Nếu có địa điểm/geo/hành vi thẻ: dùng 3 phần ' | ': [Phân khúc] | [Geo] | [Hành vi thẻ]. VD location-based: \"Nhân viên văn phòng | Bán kính 3km quanh Bitexco | Đã quẹt thẻ Shinhan tại F&B (cafe/ăn uống)\"",
        required: false,
      },
      {
        name: "discountType",
        type: "string",
        description:
          "Loại khuyến mãi: percentage (giảm %), fixed_amount (giảm tiền cố định), buy_x_get_y (mua X tặng Y), freeship (miễn phí vận chuyển)",
        required: false,
      },
      {
        name: "discountValue",
        type: "number",
        description:
          "Giá trị giảm: nếu percentage thì là % (vd: 20 = 20%), nếu fixed_amount thì là VND (vd: 50000)",
        required: false,
      },
      {
        name: "minOrderValue",
        type: "number",
        description: "Giá trị đơn hàng tối thiểu (VND) để áp dụng mã giảm giá. VD: 100000",
        required: false,
      },
      {
        name: "maxUsagePerUser",
        type: "number",
        description: "Số lần tối đa mỗi khách được dùng mã. VD: 1 = chỉ dùng 1 lần/người",
        required: false,
      },
      {
        name: "totalCodes",
        type: "number",
        description:
          "Tổng số mã giảm giá phát hành. Ảnh hưởng trực tiếp tới ngân sách và reach. VD: 200",
        required: false,
      },
      {
        name: "validityDays",
        type: "number",
        description: "Thời gian hiệu lực của mã (ngày). VD: 7 = 1 tuần",
        required: false,
      },
      {
        name: "applicableCategories",
        type: "string",
        description: 'Danh mục sản phẩm áp dụng. VD: "Trà sữa, Cafe" hoặc "Tất cả"',
        required: false,
      },
      { name: "budget", type: "number", description: "Ngân sách chiến dịch tính bằng VND", required: false },
      {
        name: "pushMessage",
        type: "string",
        description: "Nội dung tin nhắn push notification gửi cho khách hàng mục tiêu",
        required: false,
      },
    ],
    handler: (updates) => {
      const changedFields: string[] = [];
      setDraft((prev) => {
        const next = { ...prev, status: "drafting" as const };

        if (updates.title !== undefined) {
          next.title = updates.title;
          changedFields.push("title");
        }
        if (updates.targetAudience !== undefined) {
          next.targetAudience = updates.targetAudience;
          changedFields.push("targetAudience");
        }
        if (updates.budget !== undefined) {
          next.budget = updates.budget;
          changedFields.push("budget");
        }
        if (updates.pushMessage !== undefined) {
          next.pushMessage = updates.pushMessage;
          changedFields.push("pushMessage");
        }

        const discountUpdated = { ...prev.discount };
        let discountChanged = false;
        if (updates.discountType !== undefined) {
          discountUpdated.type = updates.discountType as DiscountType;
          discountChanged = true;
        }
        if (updates.discountValue !== undefined) {
          discountUpdated.value = updates.discountValue;
          discountChanged = true;
        }
        if (updates.minOrderValue !== undefined) {
          discountUpdated.minOrderValue = updates.minOrderValue;
          discountChanged = true;
        }
        if (updates.maxUsagePerUser !== undefined) {
          discountUpdated.maxUsagePerUser = updates.maxUsagePerUser;
          discountChanged = true;
        }
        if (updates.totalCodes !== undefined) {
          discountUpdated.totalCodes = updates.totalCodes;
          discountChanged = true;
        }
        if (updates.validityDays !== undefined) {
          discountUpdated.validityDays = updates.validityDays;
          discountChanged = true;
        }
        if (updates.applicableCategories !== undefined) {
          discountUpdated.applicableCategories = updates.applicableCategories;
          discountChanged = true;
        }

        if (discountChanged) {
          next.discount = discountUpdated;
          changedFields.push("discount");
        }

        return next;
      });
      triggerFlash(changedFields);
    },
  });

  useCopilotAction({
    name: "analyzeROI",
    description: `Phân tích bổ sung cho chiến dịch hiện tại. KPI chính thức đã có trong context (forecastDigest) — không cần lặp lại các con số.
Đưa ra:
- Nhận định định tính: budget vs mục tiêu, rủi ro vượt ngân sách
- Gợi ý tối ưu (giảm mức giảm, tăng đơn tối thiểu, tăng budget, v.v.)
- So sánh loại KM (nếu cần) như kịch bản what-if, ghi rõ là ước tính
Phần insight sẽ được ghép sau khối KPI chuẩn trên màn hình merchant.`,
    parameters: [
      {
        name: "insight",
        type: "string",
        description:
          "Phân tích định tính và gợi ý tối ưu. Không nhắc lại reach/ROI/doanh thu cụ thể — các số đó đã có trong forecastDigest trên UI.",
        required: true,
      },
    ],
    handler: ({ insight }) => {
      setDraft((prev) => ({
        ...prev,
        aiInsight: forecastDigest
          ? `${forecastDigest}\n\n--- Phân tích bổ sung ---\n${insight}`
          : `Chưa có dự báo hợp lệ (cần budget > 0, giá trị KM, số mã phát hành, v.v.).\n\n--- Gợi ý ---\n${insight}`,
      }));
    },
  });

  useCopilotAction({
    name: "publishCampaign",
    description:
      "Xuất bản chiến dịch sau khi merchant xác nhận. Chuyển trạng thái sang published.",
    parameters: [],
    handler: () => {
      setDraft((prev) => {
        const next = {
          ...prev,
          status: "published" as const,
          estimation: calculateEstimation(prev.budget, prev.discount),
        };
        onPublished?.(next);
        return next;
      });
    },
  });

  useCopilotAction({
    name: "resetCampaign",
    description: "Đặt lại chiến dịch về trạng thái ban đầu để tạo chiến dịch mới.",
    parameters: [],
    handler: () => {
      onResetCampaign?.();
      setDraft(INITIAL_DRAFT);
    },
  });
}
