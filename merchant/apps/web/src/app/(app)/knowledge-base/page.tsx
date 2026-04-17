"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotReadable } from "@copilotkit/react-core";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Camera,
  FileText,
  Loader2,
  MessageSquareText,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  X,
  ChevronDown,
  ChevronUp,
  ImageIcon,
} from "lucide-react";
import { SmoothAssistantMessage } from "@/components/SmoothAssistantMessage";
import { MenuReviewForm, type MenuItem } from "@/components/merchant-campaign/MenuReviewForm";
import {
  type DocType,
  type StoreDocument,
  buildKnowledgeDigest,
  deleteDocument,
  insertDocument,
  listDocuments,
} from "@/lib/supabase/knowledgeBaseRepo";
import { copilotKitThemeVars } from "@/lib/brand";
import { siteCopy } from "@/lib/siteCopy";
import { getCurrentMerchantKey } from "@/lib/supabase/client";

const CATEGORIES: { type: DocType; label: string; desc: string; icon: typeof FileText }[] = [
  {
    type: "menu",
    label: "Menu / Bảng giá",
    desc: "Upload ảnh chụp menu, bảng giá. AI sẽ trích xuất tên món, giá, nguyên liệu.",
    icon: FileText,
  },
  {
    type: "space_image",
    label: "Không gian / Vị trí",
    desc: "Ảnh quán: view sân thượng, điều hòa, thiết kế vintage... AI hiểu phong cách quán.",
    icon: Camera,
  },
  {
    type: "brand_voice",
    label: "Phong cách & Chính sách",
    desc: "Mô tả DNA thương hiệu: phong cách phục vụ, chính sách giá, quy tắc khuyến mãi.",
    icon: MessageSquareText,
  },
];

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<StoreDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUpload, setActiveUpload] = useState<DocType | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const docs = await listDocuments();
    setDocuments(docs);
    setLoading(false);
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const knowledgeDigest = buildKnowledgeDigest(documents);

  useCopilotReadable({
    description: `Kho tri thức cửa hàng (Store Knowledge Base) — bao gồm menu/bảng giá, mô tả không gian, phong cách & chính sách thương hiệu.
AI PHẢI sử dụng thông tin này khi tư vấn chiến dịch, đề xuất khuyến mãi, hoặc trả lời bất kỳ câu hỏi nào liên quan đến cửa hàng.
Nếu có menu: ưu tiên đề xuất dựa trên giá và danh mục món thực tế.
Nếu có mô tả không gian: gợi ý chiến dịch phù hợp vị trí (VD: view rooftop → quảng bá đặc biệt).
Nếu có brand voice: tuân thủ phong cách và chính sách khi soạn nội dung.`,
    value: knowledgeDigest || "(Chưa có tài liệu nào được upload)",
  });

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const menuDocs = documents.filter((d) => d.doc_type === "menu");
  const spaceDocs = documents.filter((d) => d.doc_type === "space_image");
  const brandDocs = documents.filter((d) => d.doc_type === "brand_voice");
  const docsMap: Record<DocType, StoreDocument[]> = {
    menu: menuDocs,
    space_image: spaceDocs,
    brand_voice: brandDocs,
  };

  return (
    <main style={copilotKitThemeVars as CopilotKitCSSProperties} className="flex flex-1">
      <div className="flex-1 min-w-0 overflow-y-auto scroll-container">
        <div className="app-content-container pt-6 pb-10">
          <header className="mb-8">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-shinhan-navy to-shinhan-navy-light flex items-center justify-center">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
              <div>
                <h1 className="text-[20px] font-semibold text-text-primary tracking-[-0.02em]">
                  Dạy AI hiểu về cửa hàng của bạn
                </h1>
                <p className="text-[13px] text-text-tertiary">
                  AI Store Knowledge Base — Upload tài liệu để AI trở thành cố vấn kinh doanh thực thụ
                </p>
              </div>
            </div>

            {documents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 bg-status-success-bg border border-status-success/20 rounded-xl px-4 py-3"
              >
                <p className="text-[12px] text-status-success font-medium flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  AI đã học {documents.length} tài liệu — sẵn sàng tư vấn dựa trên dữ liệu cửa hàng
                </p>
              </motion.div>
            )}
          </header>

          <div className="space-y-5">
            {CATEGORIES.map((cat) => (
              <CategorySection
                key={cat.type}
                category={cat}
                documents={docsMap[cat.type]}
                isUploading={activeUpload === cat.type}
                onUploadStart={() => setActiveUpload(cat.type)}
                onUploadEnd={() => { setActiveUpload(null); loadDocs(); }}
                onDelete={handleDelete}
                isLoading={loading}
              />
            ))}
          </div>

          <DemoComparison />
        </div>
      </div>

      <CopilotSidebar
        clickOutsideToClose={false}
        defaultOpen={true}
        AssistantMessage={SmoothAssistantMessage}
        labels={{
          title: siteCopy.product.copilotTitle,
          initial: knowledgeDigest
            ? siteCopy.knowledgeBase.copilotInitialWithDocs
            : siteCopy.knowledgeBase.copilotInitialEmpty,
        }}
      />
    </main>
  );
}

function CategorySection({
  category,
  documents,
  isUploading,
  onUploadStart,
  onUploadEnd,
  onDelete,
  isLoading,
}: {
  category: (typeof CATEGORIES)[number];
  documents: StoreDocument[];
  isUploading: boolean;
  onUploadStart: () => void;
  onUploadEnd: () => void;
  onDelete: (id: string) => void;
  isLoading: boolean;
}) {
  const Icon = category.icon;
  const isBrandVoice = category.type === "brand_voice";

  return (
    <section className="bg-surface-primary border border-border-primary/60 rounded-xl overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 w-8 h-8 rounded-lg bg-shinhan-blue-light flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-shinhan-navy" />
          </div>
          <div>
            <h3 className="text-[15px] font-semibold text-text-primary">{category.label}</h3>
            <p className="text-[12px] text-text-tertiary mt-0.5">{category.desc}</p>
          </div>
        </div>
        <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-md bg-surface-secondary text-text-tertiary font-medium">
          {documents.length} tài liệu
        </span>
      </div>

      <div className="px-5 pb-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-[12px] text-text-tertiary py-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tải...
          </div>
        ) : (
          <>
            {documents.length > 0 && (
              <div className="space-y-2 mb-3">
                {documents.map((doc) => (
                  <DocumentCard key={doc.id} doc={doc} onDelete={onDelete} />
                ))}
              </div>
            )}

            <AnimatePresence>
              {isUploading && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {isBrandVoice ? (
                    <BrandVoiceInput onDone={onUploadEnd} onCancel={onUploadEnd} />
                  ) : (
                    <ImageUploadZone docType={category.type} onDone={onUploadEnd} onCancel={onUploadEnd} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {!isUploading && (
              <button
                onClick={onUploadStart}
                className="w-full py-2.5 border border-dashed border-border-primary rounded-lg text-[12px] font-medium
                           text-text-secondary hover:border-shinhan-navy/40 hover:text-shinhan-navy hover:bg-shinhan-blue-light/30
                           transition-all duration-200 flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {isBrandVoice ? "Thêm mô tả" : "Upload ảnh"}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function DocumentCard({ doc, onDelete }: { doc: StoreDocument; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete(doc.id);
  };

  return (
    <motion.div
      layout
      className="border border-border-primary/50 rounded-lg overflow-hidden"
    >
      <div className="px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {doc.doc_type === "brand_voice" ? (
            <MessageSquareText className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-text-primary truncate">{doc.title}</p>
            {doc.file_name && (
              <p className="text-[11px] text-text-tertiary truncate">{doc.file_name}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {doc.extracted_text && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-md hover:bg-surface-secondary transition-colors text-text-tertiary"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-md hover:bg-status-error-bg transition-colors text-text-tertiary hover:text-status-error disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && doc.extracted_text && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border-primary/40"
          >
            <div className="px-3.5 py-3 bg-surface-secondary/50">
              <p className="text-[11px] font-medium text-text-tertiary mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Nội dung AI trích xuất
              </p>
              <div className="text-[12px] text-text-secondary whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                {doc.extracted_text}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ImageUploadZone({
  docType,
  onDone,
  onCancel,
}: {
  docType: DocType;
  onDone: () => void;
  onCancel: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [reviewItems, setReviewItems] = useState<MenuItem[] | null>(null);
  const [reviewFileName, setReviewFileName] = useState("");
  const [saving, setSaving] = useState(false);

  const processFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Chỉ hỗ trợ file ảnh (JPG, PNG, WebP)");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      alert("File quá lớn (tối đa 20MB)");
      return;
    }

    setProcessing(true);
    setProgress("Đang đọc ảnh...");

    const base64 = await fileToBase64(file);

    setProgress("AI đang phân tích nội dung...");
    try {
      const res = await fetch("/api/process-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64,
          doc_type: docType,
          file_name: file.name,
        }),
      });

      if (!res.ok) throw new Error("Lỗi xử lý ảnh");
      const data = await res.json();
      const { extracted_text, menu_items } = data;

      if (docType === "menu" && Array.isArray(menu_items) && menu_items.length > 0) {
        const mapped: MenuItem[] = menu_items.map(
          (item: { name: string; price: number | string; category?: string; description?: string }) => ({
            id: crypto.randomUUID(),
            name: item.name ?? "",
            price: String(item.price ?? 0),
            category: item.category ?? "",
            description: item.description ?? "",
          }),
        );
        setReviewFileName(file.name);
        setReviewItems(mapped);
        setProcessing(false);
        setProgress("");
      } else {
        setProgress("Đang lưu...");
        await insertDocument({
          merchant_key: await getCurrentMerchantKey(),
          doc_type: docType,
          title: docType === "menu" ? `Menu — ${file.name}` : `Không gian — ${file.name}`,
          file_name: file.name,
          extracted_text: extracted_text,
        });
        onDone();
      }
    } catch (err) {
      console.error(err);
      alert("Không thể xử lý ảnh. Vui lòng thử lại.");
      setProcessing(false);
      setProgress("");
    }
  };

  const handleMenuSave = async (items: MenuItem[]) => {
    setSaving(true);
    try {
      const extracted_text = items
        .map(
          (item) =>
            `${item.name}: ${Number(item.price).toLocaleString("vi-VN")}đ${item.category ? ` (${item.category})` : ""}${item.description ? ` — ${item.description}` : ""}`,
        )
        .join("\n");

      await insertDocument({
        merchant_key: await getCurrentMerchantKey(),
        doc_type: "menu",
        title: `Menu — ${reviewFileName}`,
        file_name: reviewFileName,
        extracted_text,
      });
      onDone();
    } catch (err) {
      console.error(err);
      alert("Không thể lưu menu. Vui lòng thử lại.");
      setSaving(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  if (reviewItems !== null) {
    return (
      <MenuReviewForm
        initialItems={reviewItems}
        fileName={reviewFileName}
        onSave={handleMenuSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }

  return (
    <div className="mb-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
        }}
      />

      {processing ? (
        <div className="border border-shinhan-navy/20 rounded-lg bg-shinhan-blue-light/30 px-4 py-6 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 text-shinhan-navy animate-spin" />
          <p className="text-[13px] font-medium text-shinhan-navy">{progress}</p>
          <p className="text-[11px] text-text-tertiary">Qwen OCR đang đọc nội dung ảnh...</p>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg px-4 py-6 flex flex-col items-center gap-2 cursor-pointer transition-all duration-200 ${
            dragOver
              ? "border-shinhan-navy bg-shinhan-blue-light/40"
              : "border-border-primary hover:border-shinhan-navy/40 hover:bg-surface-secondary/50"
          }`}
        >
          <Upload className="w-6 h-6 text-text-tertiary" />
          <p className="text-[13px] font-medium text-text-secondary">
            Kéo thả ảnh vào đây hoặc <span className="text-shinhan-navy">chọn file</span>
          </p>
          <p className="text-[11px] text-text-tertiary">JPG, PNG, WebP — Tối đa 20MB</p>
        </div>
      )}

      {!processing && (
        <button
          onClick={onCancel}
          className="mt-2 text-[11px] text-text-tertiary hover:text-text-secondary flex items-center gap-1"
        >
          <X className="w-3 h-3" /> Hủy
        </button>
      )}
    </div>
  );
}

function BrandVoiceInput({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    await insertDocument({
      merchant_key: await getCurrentMerchantKey(),
      doc_type: "brand_voice",
      title: title.trim() || "Phong cách thương hiệu",
      file_name: null,
      extracted_text: content.trim(),
    });
    onDone();
  };

  return (
    <div className="border border-border-primary rounded-lg p-4 mb-3 bg-surface-secondary/30">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề (VD: Chính sách giảm giá cuối tuần)"
        className="w-full px-3 py-2 mb-3 rounded-lg bg-surface-primary border border-border-primary
                   text-[13px] text-text-primary placeholder:text-text-tertiary outline-none
                   focus:border-shinhan-navy transition-colors"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={4}
        placeholder={'VD: "Quán chúng tôi theo phong cách vintage, thân thiện. Không bao giờ giảm giá trực tiếp vào cuối tuần, chỉ tặng kèm đồ uống miễn phí..."'}
        className="w-full px-3 py-2.5 rounded-lg bg-surface-primary border border-border-primary
                   text-[13px] text-text-primary placeholder:text-text-tertiary outline-none
                   focus:border-shinhan-navy transition-colors resize-none leading-relaxed"
      />
      <div className="flex items-center justify-between mt-3">
        <button
          onClick={onCancel}
          className="text-[11px] text-text-tertiary hover:text-text-secondary flex items-center gap-1"
        >
          <X className="w-3 h-3" /> Hủy
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !content.trim()}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold
                     bg-shinhan-navy text-white hover:bg-shinhan-navy-light
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Lưu
        </button>
      </div>
    </div>
  );
}

function DemoComparison() {
  return (
    <section className="mt-8 bg-surface-primary border border-border-primary/60 rounded-xl p-5">
      <h3 className="text-[15px] font-semibold text-text-primary mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-shinhan-gold" />
        Sức mạnh của AI Store Knowledge Base
      </h3>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-status-error/20 bg-status-error-bg/30 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[13px]">&#10060;</span>
            <p className="text-[13px] font-semibold text-status-error">Trước khi upload Menu</p>
          </div>
          <div className="space-y-2.5">
            <div className="bg-white/60 rounded-lg px-3 py-2">
              <p className="text-[11px] font-medium text-text-tertiary mb-0.5">SME hỏi:</p>
              <p className="text-[12px] text-text-primary">&ldquo;Gợi ý cho tôi 1 mã giảm giá.&rdquo;</p>
            </div>
            <div className="bg-white/60 rounded-lg px-3 py-2">
              <p className="text-[11px] font-medium text-text-tertiary mb-0.5">AI chung chung:</p>
              <p className="text-[12px] text-text-secondary">
                &ldquo;Hãy giảm 20% cho toàn bộ hóa đơn.&rdquo;
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-status-success/20 bg-status-success-bg/30 p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="text-[13px]">&#9989;</span>
            <p className="text-[13px] font-semibold text-status-success">Sau khi upload Menu (AI RAG)</p>
          </div>
          <div className="space-y-2.5">
            <div className="bg-white/60 rounded-lg px-3 py-2">
              <p className="text-[11px] font-medium text-text-tertiary mb-0.5">SME hỏi:</p>
              <p className="text-[12px] text-text-primary">&ldquo;Gợi ý cho tôi 1 mã giảm giá.&rdquo;</p>
            </div>
            <div className="bg-white/60 rounded-lg px-3 py-2">
              <p className="text-[11px] font-medium text-text-tertiary mb-0.5">AI thông minh (RAG):</p>
              <p className="text-[12px] text-text-secondary leading-relaxed">
                &ldquo;Tôi thấy trong Menu của bạn có món <strong>Trà Đào Cam Sả giá 45k</strong> bán rất chạy,
                nhưng <strong>Bánh Croissant giá 30k</strong> thì ít người gọi.
                Tôi đề xuất: <em>&lsquo;Tặng ngay 1 Bánh Croissant khi mua 2 Trà Đào Cam Sả&rsquo;</em>.
                Giúp xả kho bánh ngọt mà vẫn giữ biên lợi nhuận đồ uống!&rdquo;
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 bg-shinhan-blue-light rounded-lg px-4 py-3">
        <p className="text-[12px] text-shinhan-navy leading-relaxed">
          <strong>&#128161; Giá trị cốt lõi:</strong> Shinhan không chỉ cung cấp nền tảng đẩy Notification —
          Shinhan cung cấp một <strong>Cố vấn Kinh doanh AI</strong> giúp SME tăng doanh thu thông minh,
          dựa trên dữ liệu thực tế của từng cửa hàng.
        </p>
      </div>
    </section>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
