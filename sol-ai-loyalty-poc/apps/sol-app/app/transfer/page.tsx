"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import { parseEMVCo, BANK_MAP, EMVCoData } from "@/utils/qrParser";
import { logToServer } from "@/app/actions/logger";

function TransferContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawQr = searchParams.get("data");

  const [qrData, setQrData] = useState<EMVCoData | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const [purpose, setPurpose] = useState("");
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountPercentage, setDiscountPercentage] = useState<number>(0);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoadingOrder, setIsLoadingOrder] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (rawQr) {
      const decoded = decodeURIComponent(rawQr);
      const parsed = parseEMVCo(decoded);

      logToServer("TransferPage: Parsed QR Data", {
        raw: decoded,
        parsed: {
          merchant: parsed.merchantName,
          amount: parsed.transactionAmount,
          currency: parsed.transactionCurrency,
          purpose: parsed.additionalData62?.purpose,
          bank: BANK_MAP[parsed.merchantAccount38?.beneficiary?.bin || ""] || "Unknown"
        }
      });

      setQrData(parsed);

      if (parsed.transactionAmount) {
        setAmount(parseFloat(parsed.transactionAmount));
      }

      if (parsed.additionalData62?.purpose) {
        const content = parsed.additionalData62.purpose;
        setPurpose(content);

        // Extract ORDER ID from content (regex for UUID after 'ORDER-')
        const orderIdMatch = content.match(/ORDER-([a-f0-9-]{36})/i);
        if (orderIdMatch?.[1]) {
          const id = orderIdMatch[1];
          setOrderId(id);
          fetchOrderDetails(id);
        }
      }
    }
  }, [rawQr]);

  const fetchOrderDetails = async (id: string) => {
    setIsLoadingOrder(true);
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) throw new Error("Order not found or API error");
      const order = await res.json();

      logToServer("TransferPage: Order Details Fetched", order);

      // Store the verified order ID from backend
      if (order.id) {
        setOrderId(order.id);
      }

      if (order.discount_amount !== undefined) {
        setDiscountAmount(order.discount_amount);
      }

      if (order.discount_percentage !== undefined) {
        setDiscountPercentage(order.discount_percentage);
      }
    } catch (err) {
      logToServer("TransferPage: Failed to fetch order", { error: String(err) });
    } finally {
      setIsLoadingOrder(false);
    }
  };

  const handleConfirm = async () => {
    if (!orderId) {
      // Fallback for demo if no order ID found in QR
      setIsSuccess(true);
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });

      if (!res.ok) throw new Error("Failed to update order status");
      
      logToServer("TransferPage: Order Status Updated to Paid", { id: orderId });
      setIsSuccess(true);
    } catch (err) {
      logToServer("TransferPage: Failed to update status", { error: String(err) });
      // In a real app we might show an error toast, but here we'll proceed for POC
      setIsSuccess(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const bankBin = qrData?.merchantAccount38?.beneficiary?.bin || "";
  const bankName = BANK_MAP[bankBin] || "Ngân hàng liên kết";
  const accountNumber = qrData?.merchantAccount38?.beneficiary?.account || "N/A";
  const merchantName = "LE NGUYEN DUNG";

  const finalAmount = Math.max(0, amount - discountAmount);

  if (isSuccess) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <span className="text-4xl text-green-600">✓</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Chuyển khoản thành công!</h2>
        <p className="text-gray-500 text-center mb-8">
          Cảm ơn bạn đã sử dụng Shinhan SOL.
        </p>

        <div className="w-full bg-[#F5F7FA] rounded-xl p-4 mb-8 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Người nhận:</span>
            <span className="font-medium text-gray-800">{merchantName}</span>
          </div>
          <div className="flex justify-between text-sm border-t border-gray-200 pt-3 mt-2">
            <span className="text-gray-500">Số tiền:</span>
            <span className="font-bold text-[#0046BE]">{finalAmount.toLocaleString("vi-VN")}đ</span>
          </div>
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full max-w-xs py-3 bg-[#0046BE] text-white font-bold rounded-pill shadow-lg"
        >
          Về trang chủ
        </button>
      </div>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 bg-[#F5F7FA]">
      <div className="bg-white rounded-card shadow-sm overflow-hidden mb-6">
        <div className="bg-gradient-to-r from-[#0046BE] to-[#005FE3] p-6 text-white text-center">
          <p className="text-sm opacity-80 mb-1">Xác nhận chuyển tiền đến</p>
          <h2 className="text-xl font-bold">{merchantName}</h2>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Đến tài khoản</p>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-12 h-12 bg-white border border-gray-200 rounded-lg flex items-center justify-center font-bold text-[#0046BE] text-xs text-center px-1">
                {bankName.substring(0, 3).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800 uppercase">{merchantName}</p>
                <p className="text-xs text-gray-500">{bankName} | {accountNumber}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50/50 rounded-xl p-4 space-y-3 border border-blue-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Số tiền gốc</span>
              <span className="font-medium text-gray-800">{amount.toLocaleString("vi-VN")}đ</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600 flex items-center gap-1">
                  🎁 Ưu đãi ưu tiên {discountPercentage > 0 && `(${discountPercentage}%)`}
                </span>
                <span className="font-medium text-green-600">-{discountAmount.toLocaleString("vi-VN")}đ</span>
              </div>
            )}

            <div className="h-px bg-blue-100 my-1"></div>

            <div className="flex justify-between items-center">
              <span className="text-sm font-bold text-gray-800">Tổng thanh toán</span>
              <span className="text-xl font-extrabold text-[#0046BE]">
                {finalAmount.toLocaleString("vi-VN")}đ
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Nội dung chuyển khoản</label>
            <input
              type="text"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full py-2 px-1 border-b border-gray-100 focus:border-[#0046BE] outline-none text-sm font-medium"
              placeholder="Nhập nội dung..."
            />
          </div>

          <div className="pt-4">
            <button 
              onClick={handleConfirm}
              disabled={isProcessing}
              className={`w-full py-4 ${isProcessing ? 'bg-[#0046BE]/70' : 'bg-[#0046BE]'} text-white font-bold rounded-pill shadow-btn transition-all active:scale-[0.98] hover:shadow-btn-hover flex items-center justify-center gap-2`}
            >
              {isProcessing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  Đang xử lý...
                </>
              ) : (
                `Thanh toán ${finalAmount.toLocaleString("vi-VN")}đ`
              )}
            </button>
            <p className="text-center text-[10px] text-gray-400 mt-4 px-8 leading-relaxed">
              Dịch vụ được cung cấp bởi Shinhan SOL. Giao dịch an toàn & bảo mật.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function TransferPage() {
  return (
    <>
      <TopNav title="Thanh toán" showBack backHref="/qr" />
      <Suspense fallback={<div className="flex-1 flex items-center justify-center">Đang tải...</div>}>
        <TransferContent />
      </Suspense>
      <BottomNav />
    </>
  );
}
