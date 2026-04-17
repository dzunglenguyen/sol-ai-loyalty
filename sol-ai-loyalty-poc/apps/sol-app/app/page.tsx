"use client";

import Link from "next/link";
import BottomNav from "@/components/BottomNav";

const SERVICES = [
  {
    title: "Chuyển khoản",
    sub: "Trong nước\nQuốc tế",
    icon: "➡️",
    href: "#",
  },
  {
    title: "Tài khoản",
    sub: "Lịch sử giao dịch\nTruy vấn tài khoản",
    icon: "🏦",
    href: "#",
  },
  {
    title: "Mở tài khoản",
    sub: "Thanh toán\nTiết kiệm",
    icon: "💳",
    href: "#",
  },
  {
    title: "Thanh toán",
    sub: "Hóa đơn\nDịch vụ",
    icon: "🧾",
    href: "#",
  },
  {
    title: "Thẻ",
    sub: "Phát hành thẻ\nTrạng thái thẻ",
    icon: "💳",
    href: "#",
  },
  {
    title: "Vay",
    sub: "Đăng ký vay\nThông tin vay",
    icon: "💰",
    href: "#",
  },
  {
    title: "Ưu đãi & Voucher",
    sub: "AI cá nhân hóa\nĐổi voucher",
    icon: "🎁",
    href: "/vouchers",
    highlight: true,
  },
  {
    title: "Sinh trắc học",
    sub: "Đăng ký\nBật/Tắt kích hoạt",
    icon: "👁️",
    href: "#",
  },
  {
    title: "Cập nhật thông tin",
    sub: "Cập nhật CCCD\nViệt Nam",
    icon: "📋",
    href: "#",
  },
  {
    title: "Rút tiền tại ATM",
    sub: "Rút tiền mặt",
    icon: "🏧",
    href: "#",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "#F5F7FA" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#0046BE" }}>
        <div className="flex items-center gap-3">
          <button aria-label="Thông báo" className="text-white text-xl">🔔</button>
          <button aria-label="Tìm kiếm" className="text-white text-xl">🔍</button>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-white font-bold text-xs tracking-widest">Shinhan</span>
          <span className="text-white font-black text-xl leading-none tracking-tight">SOL</span>
          <span className="text-white text-xs">Vietnam</span>
        </div>
        <div className="flex items-center gap-3">
          <button aria-label="Gọi điện" className="text-white text-xl">📞</button>
          <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white flex items-center justify-center bg-red-500 text-white text-xs font-bold">VN</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Greeting + account card */}
        <div className="px-4 pt-3 pb-4" style={{ backgroundColor: "#0046BE" }}>
          <p className="text-white font-bold text-base mb-3">Xin chào, LE NGUYEN DUNG</p>
          <div className="rounded-2xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="text-white text-xs opacity-80">Số tài khoản</p>
                <div className="flex items-center gap-2">
                  <p className="text-white font-semibold text-sm">035-235-2525</p>
                  <button className="text-white opacity-70 text-xs">⧉</button>
                </div>
              </div>
              <button className="text-white opacity-80 text-2xl">⊞</button>
            </div>
            <div>
              <p className="text-white text-xs opacity-80">Số dư</p>
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold text-sm tracking-widest">*** *** *** VND</p>
                <button className="text-white opacity-70">👁</button>
              </div>
            </div>
          </div>
          <div className="flex justify-between mt-3">
            <button className="text-white text-xs opacity-90 flex items-center gap-1">
              <span>📄</span> Chọn tài khoản chính
            </button>
            <button className="text-white text-xs opacity-90 flex items-center gap-1">
              <span>🕐</span> Chi tiết tài khoản
            </button>
          </div>
        </div>

        {/* Services grid */}
        <div className="px-4 pt-4 pb-24">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-bold text-base" style={{ color: "#1A1A1A" }}>Dịch vụ Ngân hàng</h2>
            <button className="text-sm font-medium" style={{ color: "#0046BE" }}>Sắp xếp</button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {SERVICES.map((svc) => (
              <Link
                key={svc.title}
                href={svc.href}
                className="rounded-2xl p-3 flex flex-col justify-between min-h-[100px] relative overflow-hidden transition-all hover:shadow-card-elevated active:opacity-80"
                style={{
                  backgroundColor: svc.highlight ? "#0046BE" : "#FFFFFF",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
                }}
              >
                {svc.highlight && (
                  <div className="absolute inset-0 opacity-10"
                    style={{ background: "radial-gradient(circle at 80% 20%, #FF6B00, transparent 60%)" }} />
                )}
                <div>
                  <p className="font-bold text-sm leading-tight"
                    style={{ color: svc.highlight ? "#FFFFFF" : "#1A1A1A" }}>
                    {svc.title}
                  </p>
                  <p className="text-xs mt-0.5 whitespace-pre-line leading-tight"
                    style={{ color: svc.highlight ? "rgba(255,255,255,0.8)" : "#666666" }}>
                    {svc.sub}
                  </p>
                </div>
                <div className="self-end text-2xl mt-1">{svc.icon}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
