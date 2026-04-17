import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "SOL – Ưu đãi dành cho bạn",
  description: "Shinhan SOL AI Loyalty – Personalized Offers",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SOL Loyalty",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0046BE",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        {/* Mobile shell: max 390px centered */}
        <div className="min-h-screen bg-sol-surface flex justify-center">
          <div className="w-full max-w-mobile relative bg-white min-h-screen flex flex-col">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
