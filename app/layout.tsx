import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ai-brief-drab.vercel.app"),
  title: "AI Brief · AI 资讯与洞察",
  description: "聚合、验证并解读每天最值得关注的 AI 资讯。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
