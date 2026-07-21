import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { generateJson } from "../../../lib/ai";

export const dynamic = "force-dynamic";

const allowedHosts = ["openai.com", "anthropic.com", "ai.meta.com", "blog.google", "research.google", "deepmind.google", "cloud.google.com", "huggingface.co", "aws.amazon.com", "blogs.nvidia.com", "developer.nvidia.com", "arxiv.org", "machinelearning.apple.com", "github.blog", "microsoft.com", "pytorch.org", "tensorflow.org", "cloudflare.com", "databricks.com", "mozilla.ai", "ibm.com", "salesforce.com", "blog.adobe.com", "blogs.oracle.com", "community.intel.com", "blog.langchain.com", "llamaindex.ai", "wandb.ai", "pinecone.io", "weaviate.io", "qdrant.tech", "replicate.com", "cohere.com", "mistral.ai", "stability.ai", "together.ai", "groq.com", "cerebras.ai", "scale.com", "hai.stanford.edu", "allenai.org", "spectrum.ieee.org", "arstechnica.com", "wired.com", "theverge.com", "kdnuggets.com", "machinelearningmastery.com", "semianalysis.com", "jack-clark.net", "interconnects.ai", "bair.berkeley.edu", "news.mit.edu", "technologyreview.com", "techcrunch.com", "venturebeat.com", "the-decoder.com", "leiphone.com", "36kr.com", "ithome.com", "cnblogs.com", "ifanr.com", "qbitai.com", "infoq.cn"];

const decode = (value = "") => {
  let text = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let pass = 0; pass < 3; pass += 1) {
    text = text.replace(/&nbsp;|&#160;/gi, " ").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
      .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&")
      .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  }
  return text.replace(/\s+/g, " ").trim();
};

const meta = (html: string, key: string) => {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return decode(html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["']`, "i"))?.[1] ?? "");
};

const attr = (tag: string, name: string) => decode(tag.match(new RegExp(`\\s${name}=["']([^"']+)["']`, "i"))?.[1] ?? "");

function extractImages(html: string, article: string, baseUrl: URL) {
  const candidates: Array<{ url: string; alt: string }> = [];
  const add = (rawUrl: string, alt = "") => {
    if (!rawUrl || /^(?:data:|blob:)/i.test(rawUrl)) return;
    try {
      const url = new URL(rawUrl, baseUrl);
      if (url.protocol !== "https:" || /(?:logo|avatar|icon|sprite|emoji|tracking|pixel|advert|banner|qrcode)/i.test(`${url.pathname} ${alt}`)) return;
      if (!candidates.some((image) => image.url === url.href)) candidates.push({ url: url.href, alt: alt.slice(0, 120) });
    } catch { /* Ignore malformed image URLs. */ }
  };
  add(meta(html, "og:image"), meta(html, "og:title"));
  for (const tag of article.match(/<img\b[^>]*>/gi) ?? []) {
    const width = Number(attr(tag, "width"));
    const height = Number(attr(tag, "height"));
    if ((width && width < 240) || (height && height < 140)) continue;
    const srcset = attr(tag, "srcset");
    const srcsetUrl = srcset ? srcset.split(",").at(-1)?.trim().split(/\s+/)[0] ?? "" : "";
    add(attr(tag, "data-original") || attr(tag, "data-src") || srcsetUrl || attr(tag, "src"), attr(tag, "alt"));
  }
  return candidates.slice(0, 4);
}

const completeText = (value: string, max: number) => {
  const sentences = value.match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  let result = "";
  for (const sentence of sentences) {
    if (result && result.length + sentence.length > max) break;
    if (!result && sentence.length > max) {
      const shortened = sentence.slice(0, max).replace(/[，,；;：:]?[^，,；;：:]{0,45}$/, "").trim();
      return shortened ? `${shortened}。` : "";
    }
    result += sentence;
  }
  return result;
};

function summarize(title: string, description: string, paragraphs: string[]) {
  const text = [description, ...paragraphs].join(" ");
  const sentences = text.split(/(?<=[。！？.!?])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length >= 35 && sentence.length <= 320);
  const titleTerms = title.toLowerCase().split(/[^a-z0-9\u4e00-\u9fff]+/).filter((word) => word.length > 3);
  const ranked = sentences.map((sentence, index) => ({ sentence, score: titleTerms.filter((term) => sentence.toLowerCase().includes(term)).length * 3 + Math.max(0, 4 - index) }))
    .sort((a, b) => b.score - a.score).map((item) => item.sentence);
  const keyPoints = [...new Set(ranked.map((sentence) => completeText(sentence, 220)).filter(Boolean))].slice(0, 4);
  return { overview: completeText(description || keyPoints[0] || "原文信息较少，请阅读原文了解完整内容。", 280), keyPoints };
}

const generateArticleSummary = unstable_cache(async (title: string, description: string, paragraphsJson: string) => {
  const paragraphs = JSON.parse(paragraphsJson) as string[];
  return generateJson<{ overview: string; keyPoints: string[] }>(
    "你是AI科技资讯编辑。请只基于所给原文生成中文摘要，不补充原文没有的事实。输出JSON：overview为120-220字完整概览；keyPoints为3-5条互不重复的完整句子。保留关键数字、产品名、时间和限制条件，删除媒体套话。",
    JSON.stringify({ title, description, paragraphs }),
  );
}, ["article-qwen-summary-v2"], { revalidate: 2592000 });

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "Missing URL" }, { status: 400 });
  let target: URL;
  try { target = new URL(rawUrl); } catch { return NextResponse.json({ error: "Invalid URL" }, { status: 400 }); }
  if (target.protocol !== "https:" || !allowedHosts.some((host) => target.hostname === host || target.hostname.endsWith(`.${host}`))) {
    return NextResponse.json({ error: "Source is not allowed" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(target, { signal: controller.signal, headers: { "user-agent": "AI-Brief/1.0 (+article-reader)", accept: "text/html,application/xhtml+xml" }, cf: { cacheTtl: 1800, cacheEverything: true } } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (!response.ok) throw new Error(`Article returned ${response.status}`);
    const html = await response.text();
    const cleaned = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<(nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, "");
    const article = cleaned.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? cleaned.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? cleaned;
    const paragraphs = (article.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? []).map(decode).filter((text) => text.length >= 70 && text.length <= 1600).slice(0, 10);
    const title = meta(html, "og:title") || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
    const description = meta(html, "og:description") || meta(html, "description") || meta(html, "citation_abstract") || paragraphs[0] || "";
    const publishedAt = meta(html, "article:published_time") || meta(html, "citation_date") || meta(html, "date");
    const excerpts = paragraphs.filter((paragraph) => paragraph !== description).slice(0, 3).map((paragraph) => completeText(paragraph, 460)).filter(Boolean);
    const images = extractImages(html, article, target);
    const fallbackSummary = summarize(title, description, paragraphs);
    const generated = await generateArticleSummary(title, description, JSON.stringify(paragraphs.slice(0, 8)));
    const aiSummary = generated?.overview && Array.isArray(generated.keyPoints) ? { overview: generated.overview, keyPoints: generated.keyPoints.slice(0, 5) } : fallbackSummary;
    return NextResponse.json({ title, description: completeText(description, 520), publishedAt, excerpts, images, aiSummary, aiGenerated: Boolean(generated), fetchedAt: new Date().toISOString() }, { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" } });
  } catch { return NextResponse.json({ error: "暂时无法读取原文页面" }, { status: 502 }); }
  finally { clearTimeout(timer); }
}
