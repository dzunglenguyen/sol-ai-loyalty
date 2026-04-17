"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/",         label: "Trang chủ", icon: "🏠" },
  { href: "/info",     label: "Thông tin",  icon: "ℹ️" },
  { href: "/qr",       label: "QR",         icon: "⬛" },
  { href: "/support",  label: "Hỗ trợ",     icon: "💬" },
  { href: "/settings", label: "Cài đặt",    icon: "⚙️" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex items-stretch border-t border-gray-200 bg-white"
      style={{ minHeight: "60px", flexShrink: 0 }}
    >
      {tabs.map((tab) => {
        const isActive = tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs min-h-[44px]"
            style={{ color: isActive ? "#0046BE" : "#666666" }}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            <span className="font-medium leading-tight">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
