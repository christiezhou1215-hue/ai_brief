import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";
import { safeArticleUrl } from "../../../lib/article-security";

export const dynamic = "force-dynamic";

const clean = (value = "") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/gi, " ")
  .replace(/&quot;|&#34;/gi, "\"")
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&")
  .replace(/\s+/g, " ").trim();

const meta = (html: string, names: string[]) => {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const first = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"))?.[1];
    const reversed = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"))?.[1];
    if (first || reversed) return clean(first || reversed);
  }
  return "";
};

const sentence = (value = "") => {
  const text = clean(value)
    .replace(/^[·•\-–—\s]+/, "")
    .replace(/\s*(?:品玩|极客公园|量子位|雷峰网|爱范儿|阿里云开发者社区)[。.]?$/i, "")
    .trim();
  if (!text) return "";
  return /[。！？.!?]$/.test(text) ? text : `${text}。`;
};

async function articleResponse(request: Request) {
  const url = new URL(request.url);
  const body = request.method === "POST"
    ? await request.json().catch(() => ({})) as { url?: string; title?: string; summary?: string; source?: string }
    : { url: url.searchParams.get("url") || undefined, title: url.searchParams.get("title") || undefined, summary: url.searchParams.get("summary") || undefined, source: undefined };
  if (!body.url) return NextResponse.json({ error: "缺少原文地址" }, { status: 400 });
  const articleUrl = safeArticleUrl(body.url);
  if (!articleUrl) return NextResponse.json({ error: "该地址不属于已配置的数据源" }, { status: 400 });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7_000);
  let html = "";
  try {
    const response = await fetch(articleUrl, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 AI-Brief/2.0", accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      redirect: "error",
    });
    if (response.ok) html = (await response.text()).slice(0, 1_200_000);
  } catch { /* fall back to feed data */ }
  finally { clearTimeout(timer); }

  const title = meta(html, ["og:title", "twitter:title"]) || body.title || "原文资讯";
  const description = sentence(meta(html, ["og:description", "twitter:description", "description"]) || body.summary || "");
  const imageUrl = meta(html, ["og:image", "twitter:image", "twitter:image:src"]);
  const siteName = meta(html, ["og:site_name", "application-name"]);
  const author = meta(html, ["author", "article:author"]);
  const publishedAt = meta(html, ["article:published_time", "date", "datePublished"]);
  const structuredBody = html.match(/"articleBody"\s*:\s*("(?:\\.|[^"\\])*")/i)?.[1];
  let structuredParagraphs: string[] = [];
  if (structuredBody) {
    try {
      const text = JSON.parse(structuredBody) as string;
      structuredParagraphs = text.split(/\n+|(?<=[。！？])\s+/).map(sentence);
    } catch { /* malformed publisher metadata */ }
  }
  const paragraphs = [...structuredParagraphs, ...[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => sentence(match[1]))
  ]
    .filter((text) => text.length > 35 && text.length < 900)
    .filter((text) => !/版权|责任编辑|相关阅读|扫码|关注公众号|免责声明|广告/.test(text))
    .filter((text, index, items) => items.indexOf(text) === index)
    .slice(0, 30);
  const articleText = paragraphs.join("\n").slice(0, 18_000);

  let aiSummary = description || "原文可提取内容有限，建议点击“阅读原文”查看完整报道。";
  let keyPoints = paragraphs.slice(0, 4).map((text) => sentence(text.slice(0, 180)));
  if (aiConfigured()) {
    const result = await generateJson<{ summary: string; keyPoints: string[] }>(
      "你是严谨的科技新闻编辑。根据原文生成准确、自然、没有病句的中文摘要。summary 使用3到4个完整短句，依次说明发生了什么、关键事实、为什么重要及仍需观察之处；总长度120到220字。keyPoints 提炼3到5条完整事实句，每条只表达一个有价值的要点。不得把媒体名称当作事实，不得在句末机械重复来源名，不得截断词语，不得拼接无关事件；原文信息不足时明确说明，不得编造。",
      JSON.stringify({ title, source: body.source, description, articleText }),
    );
    if (result?.summary) aiSummary = result.summary;
    if (result?.keyPoints?.length) keyPoints = result.keyPoints.map(sentence).filter((text) => text.length >= 16).slice(0, 5);
  } else if (articleText) {
    aiSummary = `${description}${/[。！？.!?]$/.test(description) ? "" : "。"} 原文重点涉及：${paragraphs.slice(0, 2).join(" ").slice(0, 300)}`;
  }

  return NextResponse.json({ title, description, imageUrl, siteName, author, publishedAt, aiSummary: sentence(aiSummary), keyPoints, paragraphs: paragraphs.slice(0, 12) });
}

export const GET = articleResponse;
export const POST = articleResponse;
