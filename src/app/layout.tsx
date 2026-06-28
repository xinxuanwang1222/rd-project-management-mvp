import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "研发项目管理系统",
  description: "小型企业研发项目管理系统 MVP"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
