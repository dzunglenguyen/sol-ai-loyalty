import type { MerchantProfileRow } from "@/lib/supabase/tables";

function merchantName(profile: MerchantProfileRow | null): string {
  return profile?.business_name?.trim() || "cửa hàng của bạn";
}

export function copilotProactiveGreeting(profile: MerchantProfileRow | null): string {
  return `Xin chào chủ cửa hàng ${merchantName(profile)}. Tôi đã sẵn sàng giúp bạn thiết kế chiến dịch dựa trên dữ liệu thực tế từ hồ sơ merchant và dữ liệu giao dịch.

Bạn có thể đưa mục tiêu theo khu vực, thời gian, hoặc nhóm khách, tôi sẽ tự động điền form và đồng bộ KPI cho bạn.`;
}

export function copilotReadableMerchantBlock(profile: MerchantProfileRow | null): string {
  if (!profile) {
    return "Hồ sơ merchant: chưa có dữ liệu. Cần merchant hoàn tất onboarding trước khi cá nhân hóa chiến dịch.";
  }

  return `Hồ sơ merchant:
- Tên cửa hàng: ${profile.business_name || "(chưa cập nhật)"}
- Ngành: ${profile.sector || "(chưa cập nhật)"}
- Địa chỉ: ${profile.address_text || "(chưa cập nhật)"}
- Google Maps: ${profile.maps_url || "(chưa cập nhật)"}
- Tọa độ: ${
    profile.latitude != null && profile.longitude != null
      ? `${profile.latitude}, ${profile.longitude}`
      : "(chưa cập nhật)"
  }
- AOV: ${profile.aov_vnd != null ? `${profile.aov_vnd.toLocaleString("vi-VN")} VND` : "(chưa cập nhật)"}
- Giờ cao điểm: ${profile.peak_hours || "(chưa cập nhật)"}
- Phân khúc khách: ${profile.customer_segment || "(chưa cập nhật)"}
- Ghi chú AI: ${profile.ai_notes || "(chưa cập nhật)"}`;
}
