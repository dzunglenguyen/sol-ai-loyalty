"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { parseMenuFromDocumentText, type Product } from "@/lib/menuParser";
import { listDocumentsByType } from "@/lib/supabase/knowledgeBaseRepo";
import { listCampaigns } from "@/lib/supabase/campaignsRepo";
import { createOrder, markOrderAsPaid, updateOrderQrPayload } from "@/lib/supabase/ordersRepo";
import { insertQrScanForOrder } from "@/lib/supabase/qrScansRepo";
import { getCurrentMerchantKey } from "@/lib/supabase/client";
import { buildVietQrPayload, SHINHAN_VIETQR_BANK_BIN } from "@/lib/merchant-campaign/qr";
import { formatVND } from "@/lib/formatCurrency";
import type { CampaignRow } from "@/lib/supabase/tables";

// ─── Cart item ───────────────────────────────────────────
type CartItem = {
  product: Product;
  quantity: number;
};

// ─── Discount logic ──────────────────────────────────────
function applyDiscount(
  subtotal: number,
  campaign: CampaignRow | null,
): { discountAmount: number; totalAmount: number } {
  if (!campaign) return { discountAmount: 0, totalAmount: subtotal };

  const d = campaign.draft.discount;
  let discountAmount = 0;

  switch (d.type) {
    case "percentage":
      discountAmount = Math.round(subtotal * (d.value / 100));
      break;
    case "fixed_amount":
      discountAmount = d.value;
      break;
    case "buy_x_get_y":
      discountAmount = Math.round(subtotal * 0.1);
      break;
    case "freeship":
      discountAmount = 25000;
      break;
  }

  discountAmount = Math.min(discountAmount, subtotal);
  return { discountAmount, totalAmount: subtotal - discountAmount };
}

// ─── Page ────────────────────────────────────────────────
export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [showCampaignDropdown, setShowCampaignDropdown] = useState(false);
  const [generatedOrderId, setGeneratedOrderId] = useState<string | null>(null);
  const [generatedQrPayload, setGeneratedQrPayload] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [recentOrders, setRecentOrders] = useState<
    { id: string; total: number; status: string; created_at: string }[]
  >([]);

  // Load products from menu documents
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const docs = await listDocumentsByType("menu");
      if (!mounted) return;
      const allProducts = docs.flatMap((d) =>
        d.extracted_text ? parseMenuFromDocumentText(d.extracted_text) : [],
      );
      setProducts(allProducts);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  // Load active campaigns
  useEffect(() => {
    listCampaigns().then((rows) => {
      setCampaigns(rows.filter((r) => r.is_active && r.status === "published"));
    });
  }, []);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  // Filtered products
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }, [products, search]);

  // Cart calculations
  const subtotal = useMemo(
    () => cart.reduce((sum, ci) => sum + ci.product.price * ci.quantity, 0),
    [cart],
  );
  const { discountAmount, totalAmount } = useMemo(
    () => applyDiscount(subtotal, selectedCampaign),
    [subtotal, selectedCampaign],
  );

  // Cart actions
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((ci) => ci.product.id === product.id);
      if (existing) {
        return prev.map((ci) =>
          ci.product.id === product.id ? { ...ci, quantity: ci.quantity + 1 } : ci,
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) =>
          ci.product.id === productId
            ? { ...ci, quantity: Math.max(0, ci.quantity + delta) }
            : ci,
        )
        .filter((ci) => ci.quantity > 0),
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((ci) => ci.product.id !== productId));
  }, []);

  const resetOrder = useCallback(() => {
    setCart([]);
    setSelectedCampaignId(null);
    setGeneratedOrderId(null);
    setGeneratedQrPayload(null);
    setIsPaid(false);
  }, []);

  // Generate QR & create order
  const handleGenerateQr = async () => {
    if (cart.length === 0) return;
    setIsGenerating(true);
    try {
      const bankBin = process.env.NEXT_PUBLIC_QR_BANK_BIN || SHINHAN_VIETQR_BANK_BIN;
      const accountNumber = process.env.NEXT_PUBLIC_QR_ACCOUNT_NUMBER || "0352352525";
      const merchantCity = process.env.NEXT_PUBLIC_QR_MERCHANT_CITY || "HO CHI MINH";

      // Try to save order to DB (non-blocking — QR still shows even if save fails)
      try {
        const merchantKey = await getCurrentMerchantKey();
        const orderItems = cart.map((ci) => ({
          name: ci.product.name,
          price: ci.product.price,
          quantity: ci.quantity,
          category: ci.product.category,
        }));

        const order = await createOrder({
          merchant_key: merchantKey,
          campaign_id: selectedCampaignId,
          items: orderItems,
          subtotal,
          discount_amount: discountAmount,
          total_amount: totalAmount,
          qr_payload: null,
          transfer_content: null,
        });

        if (order) {
          const transferContent = `ORDER-${order.id}`;
          const qrPayload = buildVietQrPayload({
            bankBin,
            accountNumber,
            amount: totalAmount,
            description: transferContent,
            merchantName: "SHINHAN MERCHANT",
            merchantCity,
          });

          setGeneratedQrPayload(qrPayload);
          setGeneratedOrderId(order.id);
          await updateOrderQrPayload(order.id, qrPayload, transferContent);
        } else {
          // Fallback: still generate QR when order persistence fails.
          const qrPayload = buildVietQrPayload({
            bankBin,
            accountNumber,
            amount: totalAmount,
            description: `SOL-${Date.now().toString(36).toUpperCase()}`,
            merchantName: "SHINHAN MERCHANT",
            merchantCity,
          });
          setGeneratedQrPayload(qrPayload);
        }
      } catch (dbErr) {
        console.error("[pos] Order save failed (QR still generated):", dbErr);
        // QR is still shown; order tracking just won't be available.
        const qrPayload = buildVietQrPayload({
          bankBin,
          accountNumber,
          amount: totalAmount,
          description: `SOL-${Date.now().toString(36).toUpperCase()}`,
          merchantName: "SHINHAN MERCHANT",
          merchantCity,
        });
        setGeneratedQrPayload(qrPayload);
      }
    } catch (err) {
      console.error("[pos] QR generation failed:", err);
      alert("Không thể tạo mã QR. Vui lòng thử lại.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Mark as paid
  const handleMarkPaid = async () => {
    try {
      if (generatedOrderId) {
        const order = await markOrderAsPaid(generatedOrderId);
        if (order) {
          await insertQrScanForOrder(generatedOrderId, selectedCampaignId);
          setRecentOrders((prev) => [
            { id: order.id, total: order.total_amount, status: "paid", created_at: order.created_at },
            ...prev,
          ]);
        }
      }
      setIsPaid(true);
    } catch (err) {
      console.error("[pos] Mark paid failed:", err);
      setIsPaid(true); // Still mark as paid in UI
    }
  };

  // Group products by category
  const categories = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const cat = p.category || "Khác";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, [filtered]);

  const cartItemCount = cart.reduce((s, ci) => s + ci.quantity, 0);

  return (
    <main className="flex-1 min-w-0 overflow-y-auto scroll-container">
      <div className="max-w-[1200px] mx-auto px-5 md:px-8 pt-6 pb-10">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-shinhan-navy to-shinhan-navy-light flex items-center justify-center">
              <ShoppingCart className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-[20px] font-semibold text-text-primary tracking-[-0.02em]">
                Thanh toán POS
              </h1>
              <p className="text-[13px] text-text-tertiary">
                Chọn món, áp khuyến mãi, tạo mã QR thanh toán
              </p>
            </div>
          </div>
        </header>

        {/* Two-column layout */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-6">
          {/* Left: Product list */}
          <div>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm món theo tên, danh mục..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-primary border border-border-primary
                           text-[13px] text-text-primary placeholder:text-text-tertiary outline-none
                           focus:border-shinhan-navy transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20 gap-2 text-text-tertiary text-[13px]">
                <Loader2 className="w-4 h-4 animate-spin" /> Đang tải menu...
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-[13px] text-text-tertiary">
                  {products.length === 0
                    ? "Chưa có menu. Hãy upload menu ở Kho tri thức AI trước."
                    : "Không tìm thấy món phù hợp."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {Array.from(categories.entries()).map(([category, items]) => (
                  <section key={category}>
                    <h3 className="text-[12px] font-semibold text-text-tertiary uppercase tracking-wider mb-2 px-1">
                      {category} ({items.length})
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {items.map((product) => {
                        const inCart = cart.find((ci) => ci.product.id === product.id);
                        return (
                          <button
                            key={product.id}
                            onClick={() => !generatedOrderId && addToCart(product)}
                            disabled={!!generatedOrderId}
                            className={`text-left px-3.5 py-3 rounded-xl border transition-all duration-200 ${
                              inCart
                                ? "border-shinhan-navy/30 bg-shinhan-blue-light/30"
                                : "border-border-primary/60 bg-surface-primary hover:border-shinhan-navy/20 hover:bg-surface-secondary/50"
                            } disabled:opacity-70 disabled:cursor-default`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[13px] font-medium text-text-primary truncate">
                                {product.name}
                              </p>
                              {inCart && (
                                <span className="shrink-0 w-5 h-5 rounded-full bg-shinhan-navy text-white text-[10px] font-semibold flex items-center justify-center">
                                  {inCart.quantity}
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-shinhan-navy font-semibold mt-0.5">
                              {formatVND(product.price)}đ
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          {/* Right: Cart & order */}
          <div className="space-y-4">
            {/* Cart */}
            <div className="bg-surface-primary border border-border-primary/60 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border-primary/40 bg-surface-secondary/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-[14px] font-semibold text-text-primary">
                    Đơn hàng
                  </h3>
                  {cartItemCount > 0 && (
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-shinhan-blue-light text-shinhan-navy font-medium">
                      {cartItemCount} món
                    </span>
                  )}
                </div>
              </div>

              {cart.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-text-tertiary">
                  Chọn món từ danh sách bên trái
                </div>
              ) : (
                <div className="divide-y divide-border-primary/30 max-h-[320px] overflow-y-auto">
                  {cart.map((ci) => (
                    <div key={ci.product.id} className="px-4 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-text-primary font-medium truncate">
                          {ci.product.name}
                        </p>
                        <p className="text-[11px] text-text-tertiary">
                          {formatVND(ci.product.price)}đ
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(ci.product.id, -1)}
                          disabled={!!generatedOrderId}
                          className="w-6 h-6 rounded-md border border-border-primary flex items-center justify-center
                                     text-text-tertiary hover:bg-surface-secondary transition-colors disabled:opacity-50"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center text-[13px] font-medium text-text-primary tabular-nums">
                          {ci.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(ci.product.id, 1)}
                          disabled={!!generatedOrderId}
                          className="w-6 h-6 rounded-md border border-border-primary flex items-center justify-center
                                     text-text-tertiary hover:bg-surface-secondary transition-colors disabled:opacity-50"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeFromCart(ci.product.id)}
                          disabled={!!generatedOrderId}
                          className="w-6 h-6 rounded-md flex items-center justify-center
                                     text-text-tertiary hover:text-status-error hover:bg-status-error-bg transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="w-20 text-right text-[13px] font-medium text-text-primary tabular-nums shrink-0">
                        {formatVND(ci.product.price * ci.quantity)}đ
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Campaign selector */}
              {cart.length > 0 && !generatedOrderId && campaigns.length > 0 && (
                <div className="px-4 py-3 border-t border-border-primary/30">
                  <p className="text-[11px] font-medium text-text-tertiary mb-1.5">
                    Áp dụng khuyến mãi (tuỳ chọn)
                  </p>
                  <div className="relative">
                    <button
                      onClick={() => setShowCampaignDropdown(!showCampaignDropdown)}
                      className="w-full px-3 py-2 rounded-lg border border-border-primary bg-surface-secondary
                                 text-[12px] text-text-primary text-left flex items-center justify-between gap-2
                                 hover:border-shinhan-navy/30 transition-colors"
                    >
                      <span className="truncate">
                        {selectedCampaign
                          ? `${selectedCampaign.title} — ${
                              selectedCampaign.draft.discount.type === "percentage"
                                ? `Giảm ${selectedCampaign.draft.discount.value}%`
                                : selectedCampaign.draft.discount.type === "fixed_amount"
                                  ? `Giảm ${formatVND(selectedCampaign.draft.discount.value)}đ`
                                  : selectedCampaign.draft.discount.type === "buy_x_get_y"
                                    ? "Mua X tặng Y"
                                    : "Miễn phí vận chuyển"
                            }`
                          : "Chọn chiến dịch khuyến mãi"}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                    </button>

                    {showCampaignDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-surface-primary border border-border-primary rounded-lg shadow-lg z-10 max-h-[200px] overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedCampaignId(null);
                            setShowCampaignDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-[12px] text-text-secondary text-left hover:bg-surface-secondary transition-colors"
                        >
                          Không áp dụng
                        </button>
                        {campaigns.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => {
                              setSelectedCampaignId(c.id);
                              setShowCampaignDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-[12px] text-left hover:bg-surface-secondary transition-colors ${
                              selectedCampaignId === c.id ? "text-shinhan-navy font-medium" : "text-text-primary"
                            }`}
                          >
                            {c.title} —{" "}
                            {c.draft.discount.type === "percentage"
                              ? `Giảm ${c.draft.discount.value}%`
                              : c.draft.discount.type === "fixed_amount"
                                ? `Giảm ${formatVND(c.draft.discount.value)}đ`
                                : c.draft.discount.type === "buy_x_get_y"
                                  ? "Mua X tặng Y"
                                  : "Miễn phí vận chuyển"}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Order summary */}
              {cart.length > 0 && (
                <div className="px-4 py-3 border-t border-border-primary/30 bg-surface-secondary/30">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-text-tertiary">Tạm tính</span>
                      <span className="text-text-primary tabular-nums">{formatVND(subtotal)}đ</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-status-success">Giảm giá</span>
                        <span className="text-status-success tabular-nums">
                          -{formatVND(discountAmount)}đ
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[14px] font-semibold pt-1 border-t border-border-primary/30">
                      <span className="text-text-primary">Tổng cộng</span>
                      <span className="text-shinhan-navy tabular-nums">{formatVND(totalAmount)}đ</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action buttons */}
            {cart.length > 0 && !generatedOrderId && (
              <button
                onClick={handleGenerateQr}
                disabled={isGenerating}
                className="w-full py-3 rounded-xl bg-shinhan-navy text-white text-[13px] font-semibold
                           hover:bg-shinhan-navy-light transition-colors
                           disabled:opacity-50 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                {isGenerating ? "Đang tạo..." : "Tạo QR thanh toán"}
              </button>
            )}

            {/* QR Display */}
            {generatedQrPayload && (
              <div className="bg-surface-primary border border-border-primary/60 rounded-xl p-5 text-center">
                {isPaid ? (
                  <>
                    <CheckCircle2 className="w-12 h-12 text-status-success mx-auto mb-3" />
                    <p className="text-[15px] font-semibold text-status-success mb-1">
                      Đã thanh toán
                    </p>
                    <p className="text-[12px] text-text-tertiary mb-4">
                      Đơn hàng ghi nhận thành công
                    </p>
                    <button
                      onClick={resetOrder}
                      className="px-5 py-2.5 rounded-xl bg-shinhan-navy text-white text-[12px] font-semibold
                                 hover:bg-shinhan-navy-light transition-colors"
                    >
                      Tạo đơn mới
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-medium text-text-primary mb-3">
                      Quét mã để thanh toán
                    </p>
                    <div className="inline-block p-3 bg-white rounded-xl mb-3">
                      <QRCodeSVG value={generatedQrPayload} size={200} />
                    </div>
                    <p className="text-[20px] font-bold text-shinhan-navy mb-1">
                      {formatVND(totalAmount)}đ
                    </p>
                    {discountAmount > 0 && (
                      <p className="text-[11px] text-status-success mb-3">
                        Đã giảm {formatVND(discountAmount)}đ
                      </p>
                    )}
                    <button
                      onClick={handleMarkPaid}
                      className="w-full py-2.5 rounded-xl bg-status-success text-white text-[12px] font-semibold
                                 hover:bg-status-success/90 transition-colors flex items-center justify-center gap-1.5 mt-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Khách đã thanh toán
                    </button>
                    <button
                      onClick={resetOrder}
                      className="w-full py-2 mt-2 text-[11px] text-text-tertiary hover:text-text-secondary"
                    >
                      Hủy đơn
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Recent orders */}
            {recentOrders.length > 0 && (
              <div className="bg-surface-primary border border-border-primary/60 rounded-xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border-primary/30 bg-surface-secondary/30">
                  <p className="text-[12px] font-semibold text-text-tertiary">
                    Đơn gần đây (phiên này)
                  </p>
                </div>
                <div className="divide-y divide-border-primary/30">
                  {recentOrders.map((o) => (
                    <div key={o.id} className="px-4 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-[11px] text-text-tertiary tabular-nums">
                          {new Date(o.created_at).toLocaleTimeString("vi-VN")}
                        </p>
                        <p className="text-[12px] text-text-primary font-medium">
                          {formatVND(o.total)}đ
                        </p>
                      </div>
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-status-success-bg text-status-success font-medium">
                        Đã thanh toán
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
