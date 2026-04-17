import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "@copilotkit/react-ui/styles.css";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SOL Merchant Campaign - Ngân hàng Shinhan",
  description:
    "Quản lý chiến dịch ưu đãi thông minh bằng AI cho Merchant trên nền tảng Shinhan SOL Smart Loyalty",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    title: "SOL Merchant Campaign - Ngân hàng Shinhan",
    description:
      "Tạo chiến dịch ưu đãi siêu tốc với trợ lý AI trên nền tảng Shinhan SOL Smart Loyalty",
    siteName: "Shinhan SOL Merchant",
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/login"
      signUpUrl="/register"
      afterSignOutUrl="/login"
    >
      <html lang="vi" className={`${geistSans.variable} ${geistMono.variable}`}>
        <body className="antialiased font-sans">{children}</body>
      </html>
    </ClerkProvider>
  );
}
