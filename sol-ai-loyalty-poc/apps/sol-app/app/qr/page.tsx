"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import TopNav from "@/components/TopNav";
import BottomNav from "@/components/BottomNav";
import QRScanner from "@/components/QRScanner";

export default function QRPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handleScanSuccess = (decodedText: string) => {
    // Encoded the data to pass via URL or use local storage
    // For simplicity, we'll use URL search params
    const encodedData = encodeURIComponent(decodedText);
    router.push(`/transfer?data=${encodedData}`);
  };

  const handleScanError = (errorMessage: string) => {
    setError(errorMessage);
    setTimeout(() => setError(null), 3000);
  };

  return (
    <>
      <TopNav title="Quét mã QR" showBack backHref="/" />

      <main className="flex-1 flex flex-col items-center p-4 bg-[#F5F7FA]">
        <div className="w-full max-w-md bg-white rounded-card p-6 shadow-sm">
          <h2 className="text-center font-bold text-lg mb-2" style={{ color: "#0046BE" }}>
            Quét mã QR Thanh toán
          </h2>
          <p className="text-center text-sm text-gray-500 mb-6 px-4">
            Di chuyển camera đến mã QR hoặc tải ảnh lên để thực hiện chuyển khoản nhanh.
          </p>

          <QRScanner onScanSuccess={handleScanSuccess} onScanError={handleScanError} />

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg text-red-600 text-sm text-center">
              {error}
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-px bg-gray-300"></span>
            <span className="text-xs text-gray-400 font-medium">HỖ TRỢ CHUẨN</span>
            <span className="w-8 h-px bg-gray-300"></span>
          </div>
          <div className="flex gap-4 opacity-40 grayscale">
            {/* Mock logos for VietQR, EMVCo etc */}
            <div className="px-3 py-1 border border-gray-400 rounded-md text-[10px] font-bold">VietQR</div>
            <div className="px-3 py-1 border border-gray-400 rounded-md text-[10px] font-bold">EMVCo</div>
            <div className="px-3 py-1 border border-gray-400 rounded-md text-[10px] font-bold">NAPAS</div>
          </div>
        </div>
      </main>

      <BottomNav />
    </>
  );
}
