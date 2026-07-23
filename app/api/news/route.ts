import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Source = { name: string; mark: string; url: string; type?: "rss" | "atom"; tier: 1 | 2 | 3; chinese?: boolean };
export type NewsItem = {
  id: string; title: string; source: string; sourceMark: string; publishedAt: string; url: string;
  category: string; level: "重要" | "关注" | "一般"; score: number; trustScore: number;
  trustLabel: "高可信" | "较可信" | "待核实"; summary: string; tags: string[];
  related: number; sourceMentions: string[]; imageUrl?: string;
};

const sources: Source[] = [
  { name: "量子位", mark: "量", url: "https://www.qbitai.com/feed", tier: 2, chinese: true },
  { name: "机器之心", mark: "机", url: "https://www.jiqizhixin.com/rss", tier: 2, chinese: true },
  { name: "新智元", mark: "新", url: "https://www.ai-era.net/feed", tier: 2, chinese: true },
  { name: "InfoQ 中文", mark: "IQ", url: "https://www.infoq.cn/feed", tier: 2, chinese: true },
  { name: "IT之家", mark: "IT", url: "https://www.ithome.com/rss/", tier: 2, chinese: true },
  { name: "36氪", mark: "36", url: "https://36kr.com/feed", tier: 2, chinese: true },
  { name: "雷峰网", mark: "雷", url: "https://www.leiphone.com/feed", tier: 2, chinese: true },
  { name: "爱范儿", mark: "爱", url: "https://www.ifanr.com/feed", tier: 2, chinese: true },
  { name: "少数派", mark: "少", url: "https://sspai.com/feed", tier: 2, chinese: true },
  { name: "虎嗅", mark: "虎", url: "https://www.huxiu.com/rss/0.xml", tier: 2, chinese: true },
  { name: "钛媒体", mark: "钛", url: "https://www.tmtpost.com/rss.xml", tier: 2, chinese: true },
  { name: "博客园", mark: "博", url: "https://feed.cnblogs.com/blog/sitehome/rss", type: "atom", tier: 3, chinese: true },
  { name: "开源中国", mark: "OS", url: "https://www.oschina.net/news/rss", tier: 3, chinese: true },
  { name: "腾讯云开发者", mark: "腾", url: "https://cloud.tencent.com/developer/rss", tier: 1, chinese: true },
  { name: "OpenAI", mark: "O", url: "https://openai.com/news/rss.xml", tier: 1 },
  { name: "Google AI", mark: "G", url: "https://blog.google/technology/ai/rss/", tier: 1 },
  { name: "Google DeepMind", mark: "DM", url: "https://deepmind.google/blog/rss.xml", tier: 1 },
  { name: "Anthropic", mark: "AN", url: "https://www.anthropic.com/rss.xml", tier: 1 },
  { name: "Meta AI", mark: "M", url: "https://ai.meta.com/blog/rss/", tier: 1 },
  { name: "Microsoft Research", mark: "MS", url: "https://www.microsoft.com/en-us/research/feed/", tier: 1 },
  { name: "NVIDIA AI", mark: "NV", url: "https://blogs.nvidia.com/blog/category/generative-ai/feed/", tier: 1 },
  { name: "Hugging Face", mark: "HF", url: "https://huggingface.co/blog/feed.xml", tier: 1 },
  { name: "GitHub AI", mark: "GH", url: "https://github.blog/ai-and-ml/feed/", tier: 1 },
  { name: "MIT AI", mark: "MIT", url: "https://news.mit.edu/rss/topic/artificial-intelligence2", tier: 1 },
  { name: "TechCrunch AI", mark: "TC", url: "https://techcrunch.com/category/artificial-intelligence/feed/", tier: 2 },
  { name: "The Verge AI", mark: "TV", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", tier: 2 },
  { name: "arXiv AI", mark: "AX", url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending", type: "atom", tier: 1 },
  { name: "arXiv LLM", mark: "CL", url: "https://export.arxiv.org/api/query?search_query=cat:cs.CL&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending", type: "atom", tier: 1 },
];

const decode = (value = "") => {
  let text = value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  for (let i = 0; i < 2; i += 1) text = text
    .replace(/&nbsp;|&#160;/gi, " ").replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&")
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)))
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
  return text.replace(/\s+/g, " ").trim();
};
const field = (block: string, tag: string) => block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "";
const linkFor = (block: string, atom: boolean) => atom
  ? block.match(/<link[^>]+href=["']([^"']+)["']/i)?.[1] ?? ""
  : decode(field(block, "link"));
const short = (value: string, max = 190) => {
  const text = decode(value);
  if (text.length <= max) return text || "点击查看这条资讯的完整内容。";
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("，"), 120))}…`;
};
const isAi = (text: string) => /人工智能|大模型|模型|智能体|机器人|算法|芯片|\bai\b|gpt|claude|gemini|deepseek|llm|agent/i.test(text);
const categoryFor = (text: string) => /agent|智能体|copilot/i.test(text) ? "AI Agent"
  : /code|coding|developer|编程|开发者/i.test(text) ? "AI 编程"
  : /image|video|multimodal|多模态|视频|图像|语音/i.test(text) ? "多模态"
  : /open.?source|开源|github/i.test(text) ? "开源项目"
  : /paper|research|benchmark|arxiv|研究|论文/i.test(text) ? "学术研究"
  : /model|gpt|gemini|claude|模型/i.test(text) ? "模型发布" : "行业动态";
const normalize = (title: string) => title.toLowerCase()
  .replace(/(?:最新|重磅|突发|官宣|独家|刚刚)/g, "").replace(/\s*[-—_|]\s*[^-—_|]{1,30}$/g, "")
  .replace(/[^a-z0-9\u4e00-\u9fff]/g, "").slice(0, 54);

let memoryCache: { at: number; payload: unknown } | null = null;

async function fetchSource(source: Source): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_600);
  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: { "user-agent": "AI-Brief/2.0", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      next: { revalidate: 900 },
    });
    if (!response.ok) throw new Error(String(response.status));
    const xml = await response.text();
    const atom = source.type === "atom";
    const blocks = xml.match(atom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi) ?? [];
    return blocks.slice(0, 18).map((block, index) => {
      const title = decode(field(block, "title"));
      const summary = short(field(block, atom ? "summary" : "description") || field(block, "content:encoded"));
      const text = `${title} ${summary}`;
      const publishedAt = decode(field(block, atom ? "published" : "pubDate") || field(block, "updated")) || new Date().toISOString();
      const baseTrust = source.tier === 1 ? 88 : source.tier === 2 ? 74 : 61;
      const score = Math.min(100, baseTrust - 20 + (/发布|推出|上线|开源|release|launch/i.test(text) ? 18 : 0) + (/gpt|gemini|claude|deepseek|模型/i.test(text) ? 11 : 0));
      const level: NewsItem["level"] = score >= 77 ? "重要" : score >= 58 ? "关注" : "一般";
      const imageUrl = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]+url=["']([^"']+)["']/i)?.[1]
        ?? block.match(/<img\b[^>]+(?:data-src|src)=["']([^"']+)["']/i)?.[1];
      return {
        id: `${source.mark}-${index}-${publishedAt}`, title, source: source.name, sourceMark: source.mark,
        publishedAt, url: linkFor(block, atom), category: categoryFor(text), level, score,
        trustScore: baseTrust, trustLabel: baseTrust >= 82 ? "高可信" : baseTrust >= 68 ? "较可信" : "待核实",
        summary, tags: [categoryFor(text), source.chinese ? "中文" : "国际"], related: 1, sourceMentions: [source.name], imageUrl,
      } satisfies NewsItem;
    }).filter((item) => item.title && item.url && (source.tier === 1 || isAi(`${item.title} ${item.summary}`)));
  } finally { clearTimeout(timer); }
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const requested = query.get("source");
  if (!requested && memoryCache && Date.now() - memoryCache.at < 15 * 60_000) {
    return NextResponse.json(memoryCache.payload, { headers: { "X-AI-Brief-Cache": "HIT" } });
  }
  const active = requested ? sources.filter((source) => source.name === requested) : sources;
  if (!active.length) return NextResponse.json({ error: "Unknown source" }, { status: 400 });
  const results = await Promise.allSettled(active.map(fetchSource));
  const groups = new Map<string, NewsItem>();
  results.forEach((result) => {
    if (result.status !== "fulfilled") return;
    result.value.forEach((item) => {
      const key = normalize(item.title);
      const existing = groups.get(key);
      if (existing) {
        existing.related += 1;
        existing.sourceMentions = [...new Set([...existing.sourceMentions, item.source])];
        existing.trustScore = Math.min(99, Math.max(existing.trustScore, item.trustScore) + Math.min(9, existing.related * 2));
        existing.trustLabel = existing.trustScore >= 82 ? "高可信" : existing.trustScore >= 68 ? "较可信" : "待核实";
      } else groups.set(key, item);
    });
  });
  const items = [...groups.values()].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 420);
  const statuses = active.map((source, index) => ({
    name: source.name, mark: source.mark, homepage: new URL(source.url).origin, type: source.type ?? "rss",
    chinese: Boolean(source.chinese), trustScore: source.tier === 1 ? 88 : source.tier === 2 ? 74 : 61,
    ok: results[index]?.status === "fulfilled", itemCount: results[index]?.status === "fulfilled" ? results[index].value.length : 0,
  }));
  const payload = {
    items, sources: statuses, updatedAt: new Date().toISOString(),
    healthySources: statuses.filter((item) => item.ok).length, totalSources: statuses.length,
  };
  if (!requested && items.length) memoryCache = { at: Date.now(), payload };
  return NextResponse.json(payload, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400" } });
}
