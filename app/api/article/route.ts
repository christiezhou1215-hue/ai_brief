import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";
import { safeArticleUrl } from "../../../lib/article-security";

export const dynamic = "force-dynamic";
type ArticlePayload = {
  title: string; description: string; imageUrl: string; siteName: string; author: string;
  publishedAt: string; aiSummary: string; keyPoints: string[]; paragraphs: string[];
};
const articleCache = new Map<string, { at: number; payload: ArticlePayload }>();

const stripNoise = (value = "") => value
  .replace(/^\s*(?:[（(]?\d{1,2}[)）]?\s*[、,，.:：\-]\s*)+/, "")
  .replace(/\s*(?:[-—–_|｜·]\s*)+(?:Sohu|搜狐(?:新闻|科技)?|QQ\s*News|腾讯新闻|新华网|光明网|人民网)(?:\s*[-—–_|｜·])?\s*$/gi, "")
  .replace(/\s*[（(]\s*(?:来源[:：]?)?\s*(?:Sohu|搜狐(?:新闻|科技)?|QQ\s*News|腾讯新闻|新华网|光明网|人民网)\s*[)）]\s*$/gi, "")
  .replace(/([A-Za-z]+-\d+(?:\.\d+)*)\.(?=\s*$)/, "$1")
  .replace(/[，,]\s*[。.!！]/g, "。")
  .replace(/\s+/g, " ")
  .trim();
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
  const text = stripNoise(clean(value))
    .replace(/^[·•\-–—\s]+/, "")
    .replace(/\s*(?:[-—–_|｜·]\s*)?(?:品玩|极客公园|量子位|雷峰网|爱范儿|阿里云开发者社区|Sohu|搜狐(?:新闻|科技)?|QQ\s*News|腾讯新闻)[。.]?$/i, "")
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
  const cacheKey = `v2::${articleUrl}::${body.title ?? ""}`;
  const cached = articleCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 24 * 60 * 60_000) {
    return NextResponse.json(cached.payload, { headers: { "X-AI-Brief-Article-Cache": "HIT" } });
  }
  let html = "";
  try {
    let current = articleUrl;
    for (let hop = 0; hop < 4; hop += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6_000);
      const response = await fetch(current, {
        signal: controller.signal,
        headers: { "user-agent": "Mozilla/5.0 AI-Brief/2.1", accept: "text/html,application/xhtml+xml" },
        cache: "no-store",
        redirect: "manual",
      }).finally(() => clearTimeout(timer));
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        const next = location ? safeArticleUrl(new URL(location, current).href) : null;
        if (!next) break;
        current = next;
        continue;
      }
      if (response.ok) html = (await response.text()).slice(0, 1_800_000);
      break;
    }
  } catch { /* fall back to feed data */ }

  const title = stripNoise(meta(html, ["og:title", "twitter:title"]) || body.title || "原文资讯");
  const description = sentence(meta(html, ["og:description", "twitter:description", "description"]) || body.summary || "");
  const imageUrl = meta(html, ["og:image", "twitter:image", "twitter:image:src"]);
  const siteName = meta(html, ["og:site_name", "application-name"]);
  const author = meta(html, ["author", "article:author"]);
  const publishedAt = meta(html, ["article:published_time", "date", "datePublished"]);
  const structuredBodies = [...html.matchAll(/"(?:articleBody|正文|content|mainText)"\s*:\s*("(?:\\.|[^"\\])*")/gi)]
    .map((match) => match[1]).slice(0, 8);
  let structuredParagraphs: string[] = [];
  for (const structuredBody of structuredBodies) {
    try {
      const text = JSON.parse(structuredBody) as string;
      if (typeof text === "string" && text.length > 80) {
        structuredParagraphs.push(...text.split(/\n+|(?<=[。！？])\s+/).map(sentence));
      }
    } catch { /* malformed publisher metadata */ }
  }
  const articleSections = [...html.matchAll(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/gi)]
    .flatMap((match) => clean(match[1]).split(/(?<=[。！？])\s+/).reduce<string[]>((groups, item) => {
      const value = sentence(item);
      if (!value) return groups;
      const last = groups.at(-1) ?? "";
      if (last.length < 180) groups[groups.length - 1] = `${last}${value}`;
      else groups.push(value);
      return groups;
    }, [""]));
  const paragraphs = [
    sentence(body.summary || ""),
    ...structuredParagraphs,
    ...[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => sentence(match[1]))
    ,
    ...articleSections,
  ]
    .filter((text) => text.length > 35 && text.length < 900)
    .filter((text) => !/版权|责任编辑|相关阅读|扫码|关注公众号|免责声明|广告|登录后|打开APP|客户端下载/.test(text))
    .filter((text, index, items) => items.indexOf(text) === index)
    .slice(0, 45);
  const articleText = paragraphs.join("\n").slice(0, 36_000);

  let aiSummary = description || "原文可提取内容有限，建议点击“阅读原文”查看完整报道。";
  let keyPoints = paragraphs.slice(0, 4).map((text) => sentence(text.slice(0, 180)));
  if (aiConfigured()) {
    const result = await generateJson<{ summary: string; keyPoints: string[] }>(
      "你是严谨的科技新闻编辑。根据原文生成准确、自然、没有病句的中文摘要。summary 必须使用5到7个完整短句，总长度240到420字，依次写清事件背景、核心动作、关键产品或技术信息、数字与时间、实际影响以及仍待验证之处。keyPoints 提炼5到7条完整事实句，每条只表达一个有价值的要点。focusTitle 是用户正在阅读的独立事件；若 originalTitle 属于早报、晚报或多事件合集，只提取与 focusTitle 直接相关的段落，绝对不得混入同页其他新闻。删除标题编号以及 Sohu、QQ News 等媒体尾缀；不得把媒体名称当作事实，不得截断模型名称或版本号，不得编造。",
      JSON.stringify({ focusTitle: body.title || title, originalTitle: title, source: body.source, description, articleText }),
    );
    if (result?.summary) aiSummary = result.summary;
    if (result?.keyPoints?.length) keyPoints = result.keyPoints.map(sentence).filter((text) => text.length >= 16).slice(0, 5);
  } else if (articleText) {
    aiSummary = `${description}${/[。！？.!?]$/.test(description) ? "" : "。"} 原文重点涉及：${paragraphs.slice(0, 2).join(" ").slice(0, 300)}`;
  }

  const payload = { title, description, imageUrl, siteName, author, publishedAt, aiSummary: sentence(aiSummary), keyPoints, paragraphs: paragraphs.slice(0, 28) };
  articleCache.set(cacheKey, { at: Date.now(), payload });
  while (articleCache.size > 100) articleCache.delete(articleCache.keys().next().value ?? "");
  return NextResponse.json(payload, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}

export const GET = articleResponse;
export const POST = articleResponse;
