import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Source = { name: string; mark: string; url: string; homepage?: string; type?: "rss" | "atom"; tier: 1 | 2 | 3; chinese?: boolean };
export type NewsItem = {
  id: string; title: string; source: string; sourceMark: string; publishedAt: string; url: string;
  category: string; level: "重要" | "关注" | "一般"; score: number; trustScore: number;
  trustLabel: "高可信" | "较可信" | "待核实"; summary: string; tags: string[];
  related: number; sourceMentions: string[]; imageUrl?: string;
};

const newsSearch = (name: string, mark: string, query: string, chinese = true, tier: 1 | 2 | 3 = 2, homepage?: string): Source => ({
  name, mark, tier, chinese, homepage,
  url: `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} AI OR 人工智能`)}&hl=${chinese ? "zh-CN" : "en-US"}&gl=${chinese ? "CN" : "US"}&ceid=${chinese ? "CN:zh-Hans" : "US:en"}`,
});

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
  ...[
    ["澎湃科技","澎","site:thepaper.cn","https://www.thepaper.cn"],
    ["央视网科技","央","site:news.cctv.com tech","https://news.cctv.com"],
    ["新华网科技","华","site:news.cn tech","https://www.news.cn"],
    ["人民网科技","人","site:people.com.cn tech","http://it.people.com.cn"],
    ["中国新闻网科技","中","site:chinanews.com tech","https://www.chinanews.com.cn"],
    ["中国科学报","科","site:sciencenet.cn","https://news.sciencenet.cn"],
    ["科技日报","技","site:stdaily.com","https://www.stdaily.com"],
    ["中国信通院","CA","site:caict.ac.cn","https://www.caict.ac.cn"],
    ["中国科学院","CAS","site:cas.cn","https://www.cas.cn"],
    ["国家数据局","数","site:nda.gov.cn","https://www.nda.gov.cn"],
    ["工信微报","工","工信部 人工智能","https://www.miit.gov.cn"],
    ["网信中国","网","site:cac.gov.cn 人工智能","https://www.cac.gov.cn"],
    ["腾讯科技","TX","site:news.qq.com tech","https://new.qq.com/ch/tech"],
    ["网易科技","易","site:163.com tech","https://tech.163.com"],
    ["新浪科技","浪","site:tech.sina.com.cn","https://tech.sina.com.cn"],
    ["搜狐科技","狐","site:sohu.com tech","https://it.sohu.com"],
    ["凤凰科技","凤","site:ifeng.com tech","https://tech.ifeng.com"],
    ["极客公园","极","site:geekpark.net","https://www.geekpark.net"],
    ["品玩","品","site:pingwest.com","https://www.pingwest.com"],
    ["差评","差","site:chaping.cn","https://www.chaping.cn"],
    ["APPSO","AP","site:ifanr.com appso","https://www.ifanr.com/appso"],
    ["CSDN","CS","site:csdn.net 人工智能","https://www.csdn.net"],
    ["掘金","掘","site:juejin.cn AI","https://juejin.cn"],
    ["SegmentFault","SF","site:segmentfault.com AI","https://segmentfault.com"],
    ["阿里云开发者","阿","site:developer.aliyun.com AI","https://developer.aliyun.com"],
    ["百度智能云","百","site:cloud.baidu.com AI","https://cloud.baidu.com"],
    ["华为云","HW","site:huaweicloud.com AI","https://www.huaweicloud.com"],
    ["火山引擎","火","site:volcengine.com AI","https://www.volcengine.com"],
    ["京东云开发者","JD","site:jdcloud.com AI","https://www.jdcloud.com"],
    ["美团技术团队","美","site:tech.meituan.com AI","https://tech.meituan.com"],
    ["字节跳动技术团队","字","site:bytedance.com tech AI","https://www.bytedance.com"],
    ["腾讯技术工程","TQ","腾讯技术工程 人工智能","https://cloud.tencent.com/developer"],
    ["小米技术","米","小米技术 人工智能","https://www.mi.com"],
    ["快手技术","快","快手技术 人工智能","https://www.kuaishou.com"],
    ["蚂蚁技术","蚁","蚂蚁技术 人工智能","https://www.antgroup.com"],
    ["百度研究院","BR","site:research.baidu.com AI","http://research.baidu.com"],
    ["阿里达摩院","达","site:damo.alibaba.com","https://damo.alibaba.com"],
    ["腾讯 AI Lab","TL","site:ai.tencent.com","https://ai.tencent.com"],
    ["华为诺亚方舟","诺","site:noahlab.com.hk","https://www.noahlab.com.hk"],
    ["智谱 AI","智","site:zhipuai.cn","https://www.zhipuai.cn"],
    ["百川智能","川","site:baichuan-ai.com","https://www.baichuan-ai.com"],
    ["月之暗面","月","site:moonshot.cn","https://www.moonshot.cn"],
    ["MiniMax","MM","site:minimaxi.com","https://www.minimaxi.com"],
    ["零一万物","零","site:01.ai","https://www.01.ai"],
    ["商汤科技","商","site:sensetime.com","https://www.sensetime.com"],
    ["科大讯飞","讯","site:iflytek.com","https://www.iflytek.com"],
    ["DeepSeek","DS","site:deepseek.com","https://www.deepseek.com"],
    ["上海人工智能实验室","浦","site:pjlab.org.cn","https://www.pjlab.org.cn"],
    ["北京智源研究院","源","site:baai.ac.cn","https://www.baai.ac.cn"],
    ["之江实验室","之","site:zhejianglab.com","https://www.zhejianglab.com"],
  ].map(([name, mark, query, homepage]) => newsSearch(name, mark, query, true, 2, homepage)),
  ...[
    ["AWS Machine Learning","AWS","site:aws.amazon.com/blogs/machine-learning","https://aws.amazon.com/blogs/machine-learning/"],
    ["Apple Machine Learning","APL","site:machinelearning.apple.com","https://machinelearning.apple.com"],
    ["IBM Research","IBM","site:research.ibm.com AI","https://research.ibm.com"],
    ["Salesforce AI","SFDC","site:blog.salesforceairesearch.com","https://blog.salesforceairesearch.com"],
    ["Adobe Research","ADB","site:research.adobe.com AI","https://research.adobe.com"],
    ["Stability AI","ST","site:stability.ai/news","https://stability.ai/news"],
    ["Mistral AI","MI","site:mistral.ai/news","https://mistral.ai/news"],
    ["Cohere","CO","site:cohere.com/blog","https://cohere.com/blog"],
    ["Perplexity","PX","site:perplexity.ai/hub/blog","https://www.perplexity.ai/hub/blog"],
    ["xAI","XA","site:x.ai/news","https://x.ai/news"],
    ["Databricks AI","DB","site:databricks.com/blog AI","https://www.databricks.com/blog"],
    ["Snowflake AI","SN","site:snowflake.com/blog AI","https://www.snowflake.com/blog"],
    ["MongoDB AI","MDB","site:mongodb.com/blog AI","https://www.mongodb.com/blog"],
    ["Vercel AI","VC","site:vercel.com/blog AI","https://vercel.com/blog"],
    ["LangChain","LC","site:blog.langchain.com","https://blog.langchain.com"],
    ["LlamaIndex","LI","site:llamaindex.ai/blog","https://www.llamaindex.ai/blog"],
    ["Together AI","TG","site:together.ai/blog","https://www.together.ai/blog"],
    ["Replicate","RP","site:replicate.com/blog","https://replicate.com/blog"],
    ["Papers with Code","PWC","site:paperswithcode.com","https://paperswithcode.com"],
    ["VentureBeat AI","VB","site:venturebeat.com/ai","https://venturebeat.com/ai/"],
    ["WIRED AI","WI","site:wired.com/tag/artificial-intelligence","https://www.wired.com/tag/artificial-intelligence/"],
    ["Ars Technica AI","ARS","site:arstechnica.com/ai","https://arstechnica.com/ai/"],
  ].map(([name, mark, query, homepage]) => newsSearch(name, mark, query, false, 2, homepage)),
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

const memoryCache = new Map<string, { at: number; payload: unknown }>();

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
  const disabled = new Set((query.get("disabled") ?? "").split("|").filter(Boolean));
  const cacheKey = requested ? `source:${requested}` : `disabled:${[...disabled].sort().join("|")}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 15 * 60_000) {
    return NextResponse.json(cached.payload, { headers: { "X-AI-Brief-Cache": "HIT" } });
  }
  const visibleSources = requested ? sources.filter((source) => source.name === requested) : sources;
  const active = visibleSources.filter((source) => !disabled.has(source.name));
  if (!active.length && requested) return NextResponse.json({ error: "Unknown source" }, { status: 400 });
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
  const statuses = visibleSources.map((source) => {
    const index = active.findIndex((item) => item.name === source.name);
    const enabled = index >= 0;
    return {
      name: source.name, mark: source.mark, homepage: source.homepage ?? new URL(source.url).origin, type: source.type ?? "rss",
      chinese: Boolean(source.chinese), trustScore: source.tier === 1 ? 88 : source.tier === 2 ? 74 : 61, enabled,
      ok: enabled && results[index]?.status === "fulfilled", itemCount: enabled && results[index]?.status === "fulfilled" ? results[index].value.length : 0,
    };
  });
  const payload = {
    items, sources: statuses, updatedAt: new Date().toISOString(),
    healthySources: statuses.filter((item) => item.ok).length, totalSources: statuses.length,
  };
  if (items.length) {
    memoryCache.set(cacheKey, { at: Date.now(), payload });
    if (memoryCache.size > 20) memoryCache.delete(memoryCache.keys().next().value ?? "");
  }
  return NextResponse.json(payload, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=86400" } });
}
