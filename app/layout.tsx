import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeWrapper } from "@/components/ThemeWrapper";

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
    <html lang="zh-CN" className="h-full antialiased dark">
      <body className="min-h-full flex flex-col">
        <ThemeWrapper>{children}</ThemeWrapper>
        <Toaster theme="dark" position="top-right" />
      </body>
    </html>
  );
}
