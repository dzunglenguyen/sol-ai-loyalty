/**
 * User-facing strings for the merchant shell (Vietnamese).
 * Keeps layout/pages aligned with product positioning without scattering literals.
 */
export const siteCopy = {
  product: {
    /** Aligns with hackathon brief: SOL loyalty, dynamic QR, merchant-funded offers. */
    loyaltyContextLine:
      "Ưu đãi cá nhân hóa trên SOL — Dynamic QR tại quầy, không cần app merchant riêng.",
    navProductLabel: "SOL Merchant",
    copilotTitle: "SOL AI Assistant",
  },
  footer: {
    productLine: "SOL Smart Loyalty",
    company: "Shinhan Bank Vietnam",
    hotline: "1900 1577",
    website: "shinhan.com.vn",
    websiteHref: "https://shinhan.com.vn",
  },
  campaign: {
    subHeaderTitle: "Quản lý chiến dịch",
    panelEyebrow: "Campaign Manager",
    panelTitle: "Danh sách chiến dịch",
    refresh: "Làm mới",
  },
  copilotTool: {
    preparing: "Đang chuẩn bị",
    executing: "Đang chạy",
    complete: "Hoàn tất",
    argsLabel: "Tham số",
    resultLabel: "Kết quả",
  },
  knowledgeBase: {
    copilotInitialWithDocs:
      "Tôi đã nạp xong dữ liệu cửa hàng của bạn! Hãy hỏi tôi bất cứ điều gì — từ gợi ý chiến dịch dựa trên menu, đến tư vấn khuyến mãi phù hợp phong cách quán.",
    copilotInitialEmpty:
      "Chào bạn! Hãy upload menu, ảnh quán, hoặc mô tả phong cách thương hiệu để tôi có thể tư vấn chính xác hơn cho cửa hàng của bạn.",
  },
} as const;
