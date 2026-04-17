"use client";

import Link from "next/link";

interface TopNavProps {
  title: string;
  showBack?: boolean;
  backHref?: string;
}

export default function TopNav({ title, showBack = false, backHref = "/" }: TopNavProps) {
  return (
    <header
      className="flex items-center justify-between px-4 text-white"
      style={{
        backgroundColor: "#0046BE",
        height: "56px",
        minHeight: "56px",
        flexShrink: 0,
      }}
    >
      {/* Left: back arrow or spacer */}
      <div className="w-10 flex items-center">
        {showBack ? (
          <Link href={backHref} className="text-white text-xl font-bold leading-none" aria-label="Quay lại">
            ‹
          </Link>
        ) : (
          <span className="w-6" />
        )}
      </div>

      {/* Center: title */}
      <h1 className="flex-1 text-center font-bold text-base leading-tight truncate px-2">
        {title}
      </h1>

      {/* Right: home icon */}
      <div className="w-10 flex items-center justify-end">
        <Link href="/" aria-label="Trang chủ" className="text-white text-xl">
          🏠
        </Link>
      </div>
    </header>
  );
}
