import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, BarChart3, DollarSign, Target, Users, Zap } from "lucide-react";
import { FADE_UP, STAGGER } from "@/components/merchant-campaign/animations";
import { EstimationCard } from "@/components/merchant-campaign/EstimationCard";
import { DISCOUNT_TYPE_LABELS } from "@/lib/merchant-campaign/constants";
import { CampaignForecastCharts } from "@/components/merchant-campaign/CampaignForecastCharts";
import type {
  BudgetEstimation,
  CampaignDraft,
  CampaignForecastDetails,
  DiscountConfig,
} from "@/lib/merchant-campaign/types";
import { formatVND } from "@/lib/formatCurrency";

export function CampaignForm({
  draft,
  flashFields,
  estimation,
  forecastDetails,
  onFieldChange,
  onDiscountChange,
  onPublish,
  isDraftReady,
}: {
  draft: CampaignDraft;
  flashFields: Set<string>;
  estimation: BudgetEstimation | null;
  forecastDetails: CampaignForecastDetails | null;
  onFieldChange: (field: keyof CampaignDraft, value: string | number) => void;
  onDiscountChange: (field: keyof DiscountConfig, value: string | number) => void;
  onPublish: () => void;
  isDraftReady: boolean;
}) {
  const discountFlash = flashFields.has("discount");

  return (
    <motion.div variants={STAGGER} initial="hidden" animate="visible">
      <motion.header variants={FADE_UP} className="mb-7">
        <h2 className="text-[24px] md:text-[28px] font-semibold tracking-[-0.025em] text-text-primary leading-[1.2]">
          Tạo chiến dịch mới
        </h2>
        <p className="text-[13px] text-text-secondary mt-1.5 max-w-[55ch] leading-[1.6]">
          Mô tả chiến dịch trong khung chat để AI tự điền form, hoặc nhập trực tiếp vào các trường bên dưới.
        </p>
      </motion.header>

      <motion.div variants={FADE_UP}>
        <SectionLabel icon={<Target className="w-3.5 h-3.5" />} text="Thông tin chiến dịch" />
        <div
          className="bg-surface-primary rounded-xl border border-border-primary/60
            shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="p-5 space-y-5">
            <FieldGroup label="Tên chiến dịch" htmlFor="title" flash={flashFields.has("title")}>
              <input
                id="title"
                type="text"
                value={draft.title}
                onChange={(e) => onFieldChange("title", e.target.value)}
                placeholder="VD: Happy Hour Trà sữa chiều nay"
                className={`form-input ${flashFields.has("title") ? "flash-input-gold" : ""}`}
              />
            </FieldGroup>

            <FieldGroup
              label="Đối tượng mục tiêu"
              htmlFor="targetAudience"
              flash={flashFields.has("targetAudience")}
            >
              <input
                id="targetAudience"
                type="text"
                value={draft.targetAudience}
                onChange={(e) => onFieldChange("targetAudience", e.target.value)}
                placeholder="Location-based: Nhân viên VP | Bán kính 3km Bitexco | Lịch sử quẹt Shinhan F&B"
                className={`form-input ${flashFields.has("targetAudience") ? "flash-input-gold" : ""}`}
              />
              <p className="text-[10px] text-text-tertiary leading-[1.5] mt-1.5">
                AI có thể điền theo 3 lớp (phân khúc | geo | hành vi thẻ) để nhấn mạnh location-based &amp;
                behavior-driven offers.
              </p>
            </FieldGroup>
          </div>
        </div>
      </motion.div>

      <motion.div variants={FADE_UP} className="mt-4">
        <SectionLabel icon={<Zap className="w-3.5 h-3.5" />} text="Thiết lập khuyến mãi" />
        <div
          className={`bg-surface-primary rounded-xl border shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors duration-500 ${
            discountFlash ? "border-shinhan-gold/60" : "border-border-primary/60"
          }`}
        >
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldGroup label="Loại khuyến mãi" htmlFor="discountType" flash={discountFlash}>
                <select
                  id="discountType"
                  value={draft.discount.type}
                  onChange={(e) => onDiscountChange("type", e.target.value)}
                  className={`form-input form-select ${discountFlash ? "flash-input-gold" : ""}`}
                >
                  {Object.entries(DISCOUNT_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </FieldGroup>

              <FieldGroup
                label={
                  draft.discount.type === "percentage"
                    ? "Giá trị giảm (%)"
                    : draft.discount.type === "buy_x_get_y"
                      ? "VD: Mua 2 tặng 1 → nhập 1"
                      : "Giá trị giảm (VND)"
                }
                htmlFor="discountValue"
                suffix={draft.discount.type === "percentage" ? "%" : "VND"}
                flash={discountFlash}
              >
                <input
                  id="discountValue"
                  type="text"
                  inputMode="numeric"
                  value={
                    draft.discount.value === 0
                      ? ""
                      : draft.discount.type === "percentage" || draft.discount.type === "buy_x_get_y"
                        ? String(draft.discount.value)
                        : formatVND(draft.discount.value)
                  }
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    onDiscountChange("value", Number(raw) || 0);
                  }}
                  placeholder={draft.discount.type === "percentage" ? "20" : "50,000"}
                  className={`form-input font-mono tabular-nums ${discountFlash ? "flash-input-gold" : ""}`}
                />
              </FieldGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FieldGroup label="Đơn tối thiểu" htmlFor="minOrderValue" suffix="VND" flash={discountFlash}>
                <input
                  id="minOrderValue"
                  type="text"
                  inputMode="numeric"
                  value={draft.discount.minOrderValue === 0 ? "" : formatVND(draft.discount.minOrderValue)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    onDiscountChange("minOrderValue", Number(raw) || 0);
                  }}
                  placeholder="50,000"
                  className={`form-input font-mono tabular-nums ${discountFlash ? "flash-input-gold" : ""}`}
                />
              </FieldGroup>

              <FieldGroup label="Giới hạn / người" htmlFor="maxUsagePerUser" suffix="lần" flash={discountFlash}>
                <input
                  id="maxUsagePerUser"
                  type="text"
                  inputMode="numeric"
                  value={draft.discount.maxUsagePerUser === 0 ? "" : String(draft.discount.maxUsagePerUser)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    onDiscountChange("maxUsagePerUser", Number(raw) || 0);
                  }}
                  placeholder="1"
                  className={`form-input font-mono tabular-nums ${discountFlash ? "flash-input-gold" : ""}`}
                />
              </FieldGroup>

              <FieldGroup label="Tổng số mã" htmlFor="totalCodes" suffix="mã" flash={discountFlash}>
                <input
                  id="totalCodes"
                  type="text"
                  inputMode="numeric"
                  value={draft.discount.totalCodes === 0 ? "" : formatVND(draft.discount.totalCodes)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    onDiscountChange("totalCodes", Number(raw) || 0);
                  }}
                  placeholder="200"
                  className={`form-input font-mono tabular-nums ${discountFlash ? "flash-input-gold" : ""}`}
                />
              </FieldGroup>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldGroup label="Hiệu lực" htmlFor="validityDays" suffix="ngày" flash={discountFlash}>
                <input
                  id="validityDays"
                  type="text"
                  inputMode="numeric"
                  value={draft.discount.validityDays === 0 ? "" : String(draft.discount.validityDays)}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, "");
                    onDiscountChange("validityDays", Number(raw) || 0);
                  }}
                  placeholder="7"
                  className={`form-input font-mono tabular-nums ${discountFlash ? "flash-input-gold" : ""}`}
                />
              </FieldGroup>

              <FieldGroup label="Danh mục áp dụng" htmlFor="applicableCategories" flash={discountFlash}>
                <input
                  id="applicableCategories"
                  type="text"
                  value={draft.discount.applicableCategories}
                  onChange={(e) => onDiscountChange("applicableCategories", e.target.value)}
                  placeholder="Tất cả, hoặc: Trà sữa, Cafe..."
                  className={`form-input ${discountFlash ? "flash-input-gold" : ""}`}
                />
              </FieldGroup>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={FADE_UP} className="mt-4">
        <SectionLabel icon={<DollarSign className="w-3.5 h-3.5" />} text="Ngân sách & Dự báo doanh thu" />
        <div
          className="bg-surface-primary rounded-xl border border-border-primary/60
            shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="p-5">
            <FieldGroup
              label="Ngân sách chiến dịch"
              htmlFor="budget"
              suffix="VND"
              flash={flashFields.has("budget")}
            >
              <input
                id="budget"
                type="text"
                inputMode="numeric"
                value={draft.budget === 0 ? "" : formatVND(draft.budget)}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, "");
                  onFieldChange("budget", Number(raw) || 0);
                }}
                placeholder="2,000,000"
                className={`form-input font-mono tabular-nums ${flashFields.has("budget") ? "flash-input-gold" : ""}`}
              />
            </FieldGroup>
          </div>

          <AnimatePresence>
            {estimation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 0.61, 0.36, 1] }}
              >
                <div className="border-t border-border-primary/50" />
                <EstimationCard estimation={estimation} totalBudget={draft.budget} />
                {forecastDetails && (
                  <CampaignForecastCharts
                    details={forecastDetails}
                    budget={draft.budget}
                    discount={draft.discount}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <AnimatePresence>
        {draft.aiInsight && (
          <motion.div
            variants={FADE_UP}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mt-4"
          >
            <div className="bg-shinhan-blue-light/50 rounded-xl border border-shinhan-navy/10 p-4">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-md bg-shinhan-navy/10 flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 className="w-3.5 h-3.5 text-shinhan-navy" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-shinhan-navy mb-1">Phân tích AI</p>
                  <p className="text-[12px] text-text-secondary leading-[1.65] whitespace-pre-line">
                    {draft.aiInsight}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={FADE_UP} className="mt-4">
        <SectionLabel icon={<Users className="w-3.5 h-3.5" />} text="Tin nhắn Push Notification" />
        <div
          className="bg-surface-primary rounded-xl border border-border-primary/60
            shadow-[0_1px_3px_rgba(0,0,0,0.02)]"
        >
          <div className="p-5">
            <FieldGroup
              label="Nội dung tin nhắn"
              htmlFor="pushMessage"
              flash={flashFields.has("pushMessage")}
            >
              <textarea
                id="pushMessage"
                value={draft.pushMessage}
                onChange={(e) => onFieldChange("pushMessage", e.target.value)}
                placeholder="VD: Bạn ơi! Hôm nay có ưu đãi sốc giảm 30% tại cửa hàng, ghé ngay nhé!"
                rows={3}
                className={`form-input resize-none ${flashFields.has("pushMessage") ? "flash-input-gold" : ""}`}
              />
            </FieldGroup>
          </div>
        </div>
      </motion.div>

      <motion.div variants={FADE_UP} className="mt-6 flex items-center gap-4">
        <motion.button
          onClick={onPublish}
          disabled={!isDraftReady}
          whileHover={isDraftReady ? { scale: 1.01 } : {}}
          whileTap={isDraftReady ? { scale: 0.975 } : {}}
          className={`
            group flex items-center gap-2.5
            px-6 py-3 rounded-lg text-[13px] font-semibold
            transition-all duration-300 ease-[cubic-bezier(0.22,0.61,0.36,1)]
            ${
              isDraftReady
                ? "cursor-pointer bg-shinhan-navy text-white shadow-[0_1px_8px_-2px_rgba(0,57,127,0.3)]"
                : "bg-shinhan-gray-light text-text-tertiary cursor-not-allowed"
            }
          `}
        >
          Xuất bản chiến dịch
          {isDraftReady && (
            <ArrowRight
              className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={2}
            />
          )}
        </motion.button>

        {!isDraftReady && draft.status === "idle" && (
          <p className="text-[12px] text-text-tertiary">
            Điền thông tin hoặc yêu cầu AI trong khung chat bên phải
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <span className="text-text-tertiary">{icon}</span>
      <span className="text-[11px] font-semibold text-text-tertiary tracking-[0.04em] uppercase">
        {text}
      </span>
    </div>
  );
}

function FieldGroup({
  label,
  htmlFor,
  suffix,
  flash,
  children,
}: {
  label: string;
  htmlFor: string;
  suffix?: string;
  flash: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={htmlFor}
          className={`text-[12px] font-medium tracking-[0.01em] transition-colors duration-300
            ${flash ? "text-shinhan-gold" : "text-text-secondary"}`}
        >
          {label}
          {flash && (
            <motion.span
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              className="ml-2 text-[10px] text-shinhan-gold font-semibold"
            >
              AI đã điền
            </motion.span>
          )}
        </label>
        {suffix && (
          <span className="text-[10px] font-mono text-text-tertiary tracking-wide">{suffix}</span>
        )}
      </div>
      {children}
    </div>
  );
}
