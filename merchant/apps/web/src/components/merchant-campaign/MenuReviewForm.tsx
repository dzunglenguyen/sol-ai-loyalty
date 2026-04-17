"use client";

import { useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";

export type MenuItem = {
  id: string;
  name: string;
  price: string;
  category: string;
  description: string;
};

interface MenuReviewFormProps {
  initialItems: MenuItem[];
  fileName: string;
  onSave: (items: MenuItem[]) => void;
  onCancel: () => void;
  saving: boolean;
}

export function MenuReviewForm({
  initialItems,
  fileName,
  onSave,
  onCancel,
  saving,
}: MenuReviewFormProps) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);

  const updateItem = (id: string, field: keyof Omit<MenuItem, "id">, value: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const deleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", price: "0", category: "", description: "" },
    ]);
  };

  const hasInvalidItems = items.some((item) => item.name.trim() === "");
  const canSave = items.length > 0 && !hasInvalidItems && !saving;

  return (
    <div className="border border-border-primary rounded-xl overflow-hidden bg-surface-primary mb-3">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border-primary/60 bg-shinhan-blue-light/30">
        <h4 className="text-[14px] font-semibold text-shinhan-navy">
          Kiểm tra và chỉnh sửa menu
        </h4>
        <p className="text-[11px] text-text-tertiary mt-0.5 truncate">{fileName}</p>
      </div>

      {/* Column headers */}
      <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
        <span className="flex-1">Tên món</span>
        <span className="w-28">Giá</span>
        <span className="w-28">Danh mục</span>
        <span className="flex-1">Mô tả</span>
        <span className="w-7" />
      </div>

      {/* Scrollable item list */}
      <div className="overflow-y-auto max-h-[360px] px-4 space-y-1.5 pb-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            {/* Name */}
            <input
              type="text"
              value={item.name}
              onChange={(e) => updateItem(item.id, "name", e.target.value)}
              placeholder="Tên món"
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface-secondary border border-border-primary
                         text-[13px] text-text-primary placeholder:text-text-tertiary outline-none
                         focus:border-shinhan-navy transition-colors min-w-0"
            />

            {/* Price */}
            <div className="w-28 flex items-center gap-1">
              <input
                type="text"
                value={item.price}
                onChange={(e) => updateItem(item.id, "price", e.target.value.replace(/\D/g, ""))}
                placeholder="0"
                className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-surface-secondary border border-border-primary
                           text-[13px] text-text-primary placeholder:text-text-tertiary outline-none
                           focus:border-shinhan-navy transition-colors text-right"
              />
              <span className="text-[12px] text-text-tertiary shrink-0">đ</span>
            </div>

            {/* Category */}
            <input
              type="text"
              value={item.category}
              onChange={(e) => updateItem(item.id, "category", e.target.value)}
              placeholder="Danh mục"
              className="w-28 px-2.5 py-1.5 rounded-lg bg-surface-secondary border border-border-primary
                         text-[12px] text-text-tertiary placeholder:text-text-tertiary outline-none
                         focus:border-shinhan-navy transition-colors"
            />

            {/* Description */}
            <input
              type="text"
              value={item.description}
              onChange={(e) => updateItem(item.id, "description", e.target.value)}
              placeholder="Mô tả (VD: 250ml)"
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface-secondary border border-border-primary
                         text-[12px] text-text-tertiary placeholder:text-text-tertiary outline-none
                         focus:border-shinhan-navy transition-colors min-w-0"
            />

            {/* Delete */}
            <button
              type="button"
              onClick={() => deleteItem(item.id)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-text-tertiary
                         hover:text-status-error hover:bg-status-error-bg transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add row button */}
      <div className="px-4 pt-1.5 pb-3">
        <button
          type="button"
          onClick={addItem}
          className="flex items-center gap-1.5 text-[12px] text-shinhan-navy hover:text-shinhan-navy-light
                     font-medium transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm món
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border-primary/60 flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 text-[12px] text-text-tertiary hover:text-text-secondary transition-colors"
        >
          <X className="w-3.5 h-3.5" />
          Hủy
        </button>

        <button
          type="button"
          onClick={() => onSave(items)}
          disabled={!canSave}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-semibold
                     bg-shinhan-navy text-white hover:bg-shinhan-navy-light
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Lưu menu ({items.length} món)
        </button>
      </div>
    </div>
  );
}
