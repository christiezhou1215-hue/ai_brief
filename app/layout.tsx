import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://ai-brief-daily.christie1215.chatgpt.site"),
  title: "AI Brief · 每日 AI 资讯",
  description: "自动聚合、去重并解读每日重要 AI 资讯。",
  openGraph: { title: "AI Brief · 每日 AI 资讯", description: "每天 5 分钟，掌握 AI 重要变化", images: ["/og.png"], locale: "zh_CN", type: "website" },
  twitter: { card: "summary_large_image", title: "AI Brief · 每日 AI 资讯", description: "每天 5 分钟，掌握 AI 重要变化", images: ["/og.png"] },
  icons: { icon: "/ai-brief-logo-v2.png", apple: "/ai-brief-logo-v2.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
