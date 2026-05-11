import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeWrapper } from "@/components/ThemeWrapper";
import { Ma_Shan_Zheng, Noto_Serif_SC } from "next/font/google";

const maShanZheng = Ma_Shan_Zheng({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-masz",
  display: "swap",
});

const notoSerifSC = Noto_Serif_SC({
  subsets: ["latin"],
  variable: "--font-noto-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "文字冒险 - AI 驱动的沉浸式文字游戏",
  description: "AI 驱动的沉浸式文字冒险游戏",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className={`h-full antialiased dark ${maShanZheng.variable} ${notoSerifSC.variable}`}>
      <body className="min-h-full flex flex-col" style={{ fontFamily: "var(--font-noto-serif), 'Noto Serif SC', serif" }}>
        <ThemeWrapper>{children}</ThemeWrapper>
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  );
}
