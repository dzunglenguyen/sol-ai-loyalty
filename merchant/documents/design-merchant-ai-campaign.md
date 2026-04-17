# Design Specification: AI-Powered Merchant Campaign (Hackathon MVP)

**Project:** SOL Smart Loyalty (Shinhan Bank Hackathon)
**Feature:** AI Generate Campaign & Dashboard on the Merchant Web Portal

---

## 1. Understanding Summary
*   **Mục đích:** Cung cấp cho Merchant một công cụ tạo chiến dịch ưu đãi siêu tốc, tự động hóa cao thông qua lệnh bằng ngôn ngữ tự nhiên, làm điểm nhấn (WOW moment) chứng minh năng lực AI tại buổi Demo Hackathon.
*   **Đối tượng:** Các chủ cửa hàng (SME) và Ban giám khảo Hackathon.
*   **Ràng buộc nội bộ:** Thời gian trình bày ngắn. Trải nghiệm người dùng phải mượt mà, thao tác ít nhưng trả về kết quả ấn tượng. Tích hợp framework CopilotKit để tương tác AI trực tiếp lên UI.
*   **Phạm vi (MVP):** Generate các biến của chiến dịch, hỗ trợ tinh chỉnh qua hội thoại, sinh luồng QR code demo ảo (mock) tích hợp với Dashboard dự đoán dữ liệu phân tích.

## 2. Assumptions (Giả định kỹ thuật)
*   Web Merchant được build trên hạ tầng **React / Next.js**.
*   Sử dụng framework **CopilotKit** (để triển khai CopilotSidebar / CopilotPopup và cung cấp context hook).
*   Thư viện hỗ trợ UI mượt mà: TailwindCSS (layout và design system), qrcode.react (Tạo QR mockup tại client).
*   AI Model đứng sau CopilotKit xử lý prompt xử lý dữ liệu sẽ kết nối thẳng hoặc mô phỏng qua **Qwen AI**.

## 3. Decision Log
| Vấn đề | Quyết định | Lý do |
| :--- | :--- | :--- |
| **Cách AI tạo chiến dịch** | Chạy dạng Copilot Action (AI nghe lệnh chat -> tự động điền Form Campaign hiển thị trên UI). | Tạo "WOW" moment khi thuật toán AI điều khiển thao tác điền form vật lý, giảm thiểu độ phức tạp cho người demo. |
| **Cơ chế chỉnh sửa nâng cao** | Cập nhật realtime bằng chat tự nhiên (Sử dụng `useCopilotReadable` & `useCopilotAction`). | Khẳng định đặc tính "trợ lý thông minh" thay vì công cụ tự điền một chiều. Hiệu ứng Flash Input trên React làm phần mềm trực quan ngay tức thì. |
| **Chi tiết Campaign sau Launch** | Một Dashboard hiển thị Predictive Trajectory (Chỉ số dự đoán doanh thu/ROI) + Standee QR xuất tệp. | Hệ thống mới triển khai ko có real data, việc xài Predictive Analytics khẳng định năng lực suy luận của AI. Trải nghiệm tải file QR offline sát với painpoint Merchant quy mô vừa. |

---

## 4. Final Design (Kiến trúc Implementation)

### 4.1 UI Layout
Giao diện Web Merchant chia màn hình 2 phần:
*   **Left Pane (70%): Main Canvas** – Vùng hiển thị Form / Bảng kết quả.
*   **Right Pane/Popup (30%): Copilot Window** – Cửa sổ nơi trợ lý hoạt động đa luồng với Merchant.

### 4.2 Data Flow & State Hooks
*   **Global Draft State:** Tạo một object React State quản lý thông số chiến dịch đang được nháp.
    ```typescript
    const [campaignDraft, setCampaignDraft] = useState({
      title: "",
      targetAudience: "",
      discountSetting: "",
      budget: 0,
      pushMessage: "",
      status: "idle" // idle | drafting | published
    });
    ```
*   **Context Sync (useCopilotReadable):** Tranh thủ khả năng AI đọc cấu trúc thông số draft này để điều chỉnh. Đoạn code báo cáo trạng thái cho Copilot:
    ```typescript
    useCopilotReadable({
      description: "Trạng thái các thông số của chiến dịch ưu đãi đang được tạo.",
      value: campaignDraft,
    });
    ```
*   **Agent Control (useCopilotAction):** Trao quyền cho AI thay đổi form. Cấu hình Action cho phép AI cập nhật một phần hoặc toàn bộ object `campaignDraft`.
    ```typescript
    useCopilotAction({
      name: "updateCampaignDraft",
      description: "Cập nhật hoặc tự tạo mới các thông số cho thẻ chiến dịch dựa vào ngữ cảnh",
      parameters: [ /* Schema tương ứng campaignDraft */ ],
      handler: (updates) => { setCampaignDraft({...campaignDraft, ...updates, status: 'drafting'}) }
    });
    ```

### 4.3 Demo Flow (Hackathon Kịch bản)
1. **Khởi tạo:** Merchant gõ vào Copilot: *"Sinh cho tôi chiến dịch thu hút khách nữ dùng trà sữa chiều nay, ngân sách 1 triệu."*
2. **Trực quan sinh động:** CopilotKit catch intention, gọi action. Form draft trên Main Canvas tự động hoàn thành 100% dữ liệu (Nháy sáng viền xanh lá trên các input box phản hồi thị giác).
3. **Hiệu chỉnh tự nhiên:** Merchant chat tiếp phản hồi *"Giảm ngân sách còn 500k và nhắm cho cả nam"*. Cửa sổ Form cập nhật lại 2 trường Budget và Target.
4. **Publish & Dashboard:** Nhấn Launch. Màn hình chuyển vào **Campaign Tracking Detail**.
   * Trên trang hiển thị biểu đồ "Predictive ROI Analytics" (Đường nét đứt dự báo lượng người dùng đến quán nhờ tệp AI target).
   * Mục **O2O Launch Kit** render một mã QR code (qrcode.react) kèm theo nút bấm bắt mắt: `Download Standee PDF` (Demo có hình ảnh preview Mockup Standee).

---
*Created via Brainstorming Collaborative Process for Shinhan SOL Loyalty Hackathon.*
