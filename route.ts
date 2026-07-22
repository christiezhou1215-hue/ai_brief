import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Source = { name: string; mark: string; url: string; type: "rss" | "atom"; aiOnly?: boolean };
type NewsItem = { id: string; title: string; source: string; sourceMark: string; publishedAt: string; category: string; level: "重要" | "关注" | "一般"; score: number; whyImportant: string; summary: string; imageUrl?: string; tags: string[]; url: string; related: number; credibility?: "官方" | "专业媒体" | "社区"; freshness?: "刚刚" | "近期" | "较早" };

const sources: Source[] = [
  { name: "OpenAI", mark: "O", url: "https://openai.com/news/rss.xml", type: "rss" },
  { name: "Google AI", mark: "G", url: "https://blog.google/technology/ai/rss/", type: "rss" },
  { name: "Google DeepMind", mark: "DM", url: "https://deepmind.google/blog/rss.xml", type: "rss" },
  { name: "Google Research", mark: "GR", url: "https://research.google/blog/rss/", type: "rss" },
  { name: "Hugging Face", mark: "HF", url: "https://huggingface.co/blog/feed.xml", type: "rss" },
  { name: "AWS · Machine Learning", mark: "AWS", url: "https://aws.amazon.com/blogs/machine-learning/feed/", type: "rss" },
  { name: "NVIDIA · Generative AI", mark: "NV", url: "https://blogs.nvidia.com/blog/category/generative-ai/feed/", type: "rss" },
  { name: "Apple Machine Learning", mark: "AP", url: "https://machinelearning.apple.com/rss.xml", type: "rss" },
  { name: "GitHub · AI & ML", mark: "GH", url: "https://github.blog/ai-and-ml/feed/", type: "rss" },
  { name: "Microsoft Research", mark: "MS", url: "https://www.microsoft.com/en-us/research/feed/", type: "rss" },
  { name: "PyTorch", mark: "PT", url: "https://pytorch.org/feed.xml", type: "rss" },
  { name: "TensorFlow", mark: "TF", url: "https://blog.tensorflow.org/feeds/posts/default", type: "atom" },
  { name: "Cloudflare · AI", mark: "CF", url: "https://blog.cloudflare.com/tag/ai/rss/", type: "rss" },
  { name: "Databricks", mark: "DB", url: "https://www.databricks.com/blog/feed", type: "rss", aiOnly: true },
  { name: "Mozilla AI", mark: "MZ", url: "https://blog.mozilla.ai/feed/", type: "rss" },
  { name: "Berkeley AI Research", mark: "BA", url: "https://bair.berkeley.edu/blog/feed.xml", type: "rss" },
  { name: "MIT · AI News", mark: "MIT", url: "https://news.mit.edu/rss/topic/artificial-intelligence2", type: "rss" },
  { name: "MIT Technology Review", mark: "TR", url: "https://www.technologyreview.com/topic/artificial-intelligence/feed/", type: "rss" },
  { name: "TechCrunch · AI", mark: "TC", url: "https://techcrunch.com/category/artificial-intelligence/feed/", type: "rss" },
  { name: "VentureBeat · AI", mark: "VB", url: "https://venturebeat.com/category/ai/feed/", type: "rss" },
  { name: "The Decoder", mark: "TD", url: "https://the-decoder.com/feed/", type: "rss" },
  { name: "Anthropic", mark: "AN", url: "https://www.anthropic.com/rss.xml", type: "rss" },
  { name: "Meta AI", mark: "M", url: "https://ai.meta.com/blog/rss/", type: "rss" },
  { name: "Microsoft AI", mark: "MA", url: "https://blogs.microsoft.com/ai/feed/", type: "rss" },
  { name: "xAI", mark: "xAI", url: "https://x.ai/blog/rss.xml", type: "rss", aiOnly: true },
  { name: "Amazon Science", mark: "AS", url: "https://www.amazon.science/index.rss", type: "rss", aiOnly: true },
  { name: "Google Developers · AI", mark: "GD", url: "https://developers.googleblog.com/feeds/posts/default/-/AI", type: "atom", aiOnly: true },
  { name: "EleutherAI", mark: "EL", url: "https://www.eleuther.ai/feed.xml", type: "rss", aiOnly: true },
  { name: "LAION", mark: "LA", url: "https://laion.ai/blog/feed/", type: "rss", aiOnly: true },
  { name: "Open Source Initiative", mark: "OSI", url: "https://opensource.org/feed/", type: "rss", aiOnly: true },
  { name: "Google Cloud AI", mark: "GC", url: "https://cloud.google.com/blog/products/ai-machine-learning/rss", type: "rss" },
  { name: "NVIDIA Developer", mark: "ND", url: "https://developer.nvidia.com/blog/feed/", type: "rss", aiOnly: true },
  { name: "IBM AI", mark: "IBM", url: "https://www.ibm.com/blog/category/artificial-intelligence/feed/", type: "rss" },
  { name: "Salesforce AI", mark: "SF", url: "https://www.salesforce.com/news/stories/category/ai/feed/", type: "rss" },
  { name: "Adobe AI", mark: "AD", url: "https://blog.adobe.com/en/topics/ai-ml.feed.xml", type: "rss" },
  { name: "Oracle AI", mark: "OR", url: "https://blogs.oracle.com/ai-and-datascience/rss", type: "rss" },
  { name: "Intel AI", mark: "IN", url: "https://community.intel.com/t5/Blogs/Tech-Innovation/Artificial-Intelligence-AI/bg-p/blog-ai/rss", type: "rss" },
  { name: "Hugging Face Papers", mark: "HP", url: "https://huggingface.co/papers/feed.xml", type: "rss" },
  { name: "LangChain", mark: "LC", url: "https://blog.langchain.com/rss/", type: "rss" },
  { name: "LlamaIndex", mark: "LI", url: "https://www.llamaindex.ai/blog/rss.xml", type: "rss" },
  { name: "Weights & Biases", mark: "WB", url: "https://wandb.ai/fully-connected/rss.xml", type: "rss" },
  { name: "Pinecone", mark: "PC", url: "https://www.pinecone.io/blog/rss/", type: "rss" },
  { name: "Weaviate", mark: "WV", url: "https://weaviate.io/blog/rss.xml", type: "rss" },
  { name: "Qdrant", mark: "QD", url: "https://qdrant.tech/articles/index.xml", type: "rss" },
  { name: "Replicate", mark: "RP", url: "https://replicate.com/blog/rss", type: "rss" },
  { name: "Cohere", mark: "CO", url: "https://cohere.com/blog/rss.xml", type: "rss" },
  { name: "Mistral AI", mark: "MI", url: "https://mistral.ai/news/rss.xml", type: "rss" },
  { name: "Stability AI", mark: "ST", url: "https://stability.ai/news/rss", type: "rss" },
  { name: "Together AI", mark: "TO", url: "https://www.together.ai/blog/rss.xml", type: "rss" },
  { name: "Groq", mark: "GQ", url: "https://groq.com/blog/rss.xml", type: "rss" },
  { name: "Cerebras", mark: "CB", url: "https://www.cerebras.ai/blog/rss.xml", type: "rss" },
  { name: "Scale AI", mark: "SC", url: "https://scale.com/blog/rss.xml", type: "rss" },
  { name: "Stanford HAI", mark: "SH", url: "https://hai.stanford.edu/news/rss.xml", type: "rss" },
  { name: "Allen AI", mark: "AA", url: "https://allenai.org/blog/feed.xml", type: "rss" },
  { name: "IEEE Spectrum · AI", mark: "IE", url: "https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss", type: "rss" },
  { name: "Ars Technica · AI", mark: "AR", url: "https://feeds.arstechnica.com/arstechnica/technology-lab", type: "rss", aiOnly: true },
  { name: "WIRED · AI", mark: "WI", url: "https://www.wired.com/feed/tag/ai/latest/rss", type: "rss" },
  { name: "The Verge · AI", mark: "TV", url: "https://www.theverge.com/rss/ai-artificial-intelligence/index.xml", type: "rss" },
  { name: "KDnuggets", mark: "KD", url: "https://www.kdnuggets.com/feed", type: "rss", aiOnly: true },
  { name: "Machine Learning Mastery", mark: "MM", url: "https://machinelearningmastery.com/blog/feed/", type: "rss" },
  { name: "SemiAnalysis", mark: "SA", url: "https://semianalysis.com/feed", type: "rss", aiOnly: true },
  { name: "Import AI", mark: "IA", url: "https://jack-clark.net/feed/", type: "rss", aiOnly: true },
  { name: "Interconnects", mark: "IC", url: "https://www.interconnects.ai/feed", type: "rss", aiOnly: true },
  { name: "雷峰网", mark: "雷", url: "https://www.leiphone.com/feed", type: "rss", aiOnly: true },
  { name: "36氪", mark: "36", url: "https://36kr.com/feed", type: "rss", aiOnly: true },
  { name: "IT之家", mark: "IT", url: "https://www.ithome.com/rss/", type: "rss", aiOnly: true },
  { name: "博客园", mark: "博", url: "https://feed.cnblogs.com/blog/sitehome/rss", type: "atom", aiOnly: true },
  { name: "爱范儿", mark: "爱", url: "https://www.ifanr.com/feed", type: "rss", aiOnly: true },
  { name: "量子位", mark: "量", url: "https://www.qbitai.com/feed", type: "rss", aiOnly: true },
  { name: "InfoQ 中文", mark: "IQ", url: "https://www.infoq.cn/feed", type: "rss", aiOnly: true },
  { name: "机器之心", mark: "机", url: "https://www.jiqizhixin.com/rss", type: "rss", aiOnly: true },
  { name: "新智元", mark: "新", url: "https://www.aixinzhijie.com/rss", type: "rss", aiOnly: true },
  { name: "极客公园", mark: "极", url: "https://www.geekpark.net/rss", type: "rss", aiOnly: true },
  { name: "钛媒体", mark: "钛", url: "https://www.tmtpost.com/feed", type: "rss", aiOnly: true },
  { name: "少数派", mark: "少", url: "https://sspai.com/feed", type: "rss", aiOnly: true },
  { name: "开源中国", mark: "OS", url: "https://www.oschina.net/news/rss", type: "rss", aiOnly: true },
  { name: "虎嗅", mark: "虎", url: "https://www.huxiu.com/rss/0.xml", type: "rss", aiOnly: true },
  { name: "极客邦科技", mark: "极客", url: "https://feed.infoq.com/cn", type: "rss", aiOnly: true },
  { name: "智东西", mark: "智", url: "https://zhidx.com/feed", type: "rss", aiOnly: true },
  { name: "甲子光年", mark: "甲", url: "https://www.jazzyear.com/rss", type: "rss", aiOnly: true },
  { name: "亿欧网", mark: "亿", url: "https://www.iyiou.com/rss", type: "rss", aiOnly: true },
  { name: "创业邦", mark: "创", url: "https://www.cyzone.cn/rss", type: "rss", aiOnly: true },
  { name: "雷科技", mark: "雷科", url: "https://www.leikeji.com/feed", type: "rss", aiOnly: true },
  { name: "极客之选", mark: "极选", url: "https://www.geekchoice.com/rss", type: "rss", aiOnly: true },
  { name: "科技行者", mark: "行", url: "https://www.ciotimes.com/feed", type: "rss", aiOnly: true },
  { name: "arXiv · cs.AI", mark: "AX", url: "https://export.arxiv.org/api/query?search_query=cat:cs.AI&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending", type: "atom" },
  { name: "arXiv · cs.CL", mark: "CL", url: "https://export.arxiv.org/api/query?search_query=cat:cs.CL&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending", type: "atom" },
  { name: "arXiv · cs.LG", mark: "ML", url: "https://export.arxiv.org/api/query?search_query=cat:cs.LG&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending", type: "atom" },
  { name: "arXiv · cs.CV", mark: "CV", url: "https://export.arxiv.org/api/query?search_query=cat:cs.CV&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending", type: "atom" },
  { name: "arXiv · cs.RO", mark: "RO", url: "https://export.arxiv.org/api/query?search_query=cat:cs.RO&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending", type: "atom" },
  { name: "arXiv · cs.IR", mark: "IR", url: "https://export.arxiv.org/api/query?search_query=cat:cs.IR&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending", type: "atom" },
  { name: "arXiv · stat.ML", mark: "SM", url: "https://export.arxiv.org/api/query?search_query=cat:stat.ML&start=0&max_results=15&sortBy=submittedDate&sortOrder=descending", type: "atom" },
];

const homepageFor = (source: Source) => {
  const custom: Record<string, string> = {
    "arXiv · cs.AI": "https://arxiv.org/list/cs.AI/recent", "arXiv · cs.CL": "https://arxiv.org/list/cs.CL/recent", "arXiv · cs.LG": "https://arxiv.org/list/cs.LG/recent", "arXiv · cs.CV": "https://arxiv.org/list/cs.CV/recent", "arXiv · cs.RO": "https://arxiv.org/list/cs.RO/recent", "arXiv · cs.IR": "https://arxiv.org/list/cs.IR/recent", "arXiv · stat.ML": "https://arxiv.org/list/stat.ML/recent",
    "博客园": "https://www.cnblogs.com/", "InfoQ 中文": "https://www.infoq.cn/", "IT之家": "https://www.ithome.com/", "机器之心": "https://www.jiqizhixin.com/", "新智元": "https://www.aixinzhijie.com/", "极客公园": "https://www.geekpark.net/", "钛媒体": "https://www.tmtpost.com/", "少数派": "https://sspai.com/", "开源中国": "https://www.oschina.net/", "虎嗅": "https://www.huxiu.com/", "极客邦科技": "https://www.infoq.cn/", "智东西": "https://zhidx.com/", "甲子光年": "https://www.jazzyear.com/", "亿欧网": "https://www.iyiou.com/", "创业邦": "https://www.cyzone.cn/", "雷科技": "https://www.leikeji.com/", "极客之选": "https://www.geekchoice.com/", "科技行者": "https://www.ciotimes.com/",
  };
  return custom[source.name] ?? new URL(source.url).origin;
};

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

const field = (block: string, tag: string) => block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] ?? "";
const link = (block: string, atom: boolean) => atom
  ? block.match(/<link[^>]+href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i)?.[1] ?? ""
  : decode(field(block, "link"));

const conciseSummary = (value: string, max = 180) => {
  const text = decode(value);
  const sentences = text.match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  let result = "";
  for (const sentence of sentences) {
    if (result && result.length + sentence.length > max) break;
    if (!result && sentence.length > max) {
      const shortened = sentence.slice(0, max).replace(/[，,；;：:]?[^，,；;：:]{0,35}$/, "").trim();
      return shortened ? `${shortened}。` : "点击查看详情，了解这条资讯的关键信息。";
    }
    result += sentence;
    if (result.length >= 90) break;
  }
  return result || "点击查看详情，了解这条资讯的关键信息。";
};

const imageFrom = (block: string, articleUrl: string) => {
  const raw = block.match(/<(?:media:content|media:thumbnail|enclosure)\b[^>]+url=["']([^"']+)["']/i)?.[1]
    ?? block.match(/<img\b[^>]+(?:data-original|data-src|src)=["']([^"']+)["']/i)?.[1] ?? "";
  try { const url = new URL(decode(raw), articleUrl); return url.protocol === "https:" ? url.href : undefined; } catch { return undefined; }
};

function classify(title: string, summary: string) {
  const text = `${title} ${summary}`.toLowerCase();
  if (/agent|智能体|agentic/.test(text)) return "AI Agent";
  if (/code|coding|developer|编程/.test(text)) return "AI 编程";
  if (/image|video|multimodal|多模态|视频|图像/.test(text)) return "多模态";
  if (/open.source|开源|github|release/.test(text)) return "开源项目";
  if (/paper|research|benchmark|arxiv|研究|论文/.test(text)) return "学术研究";
  if (/model|gpt|gemini|模型/.test(text)) return "模型发布";
  return "行业动态";
}

function tagsFor(title: string, source: string, category: string) {
  const candidates = [source, category, "OpenAI", "Google", "Gemini", "GPT", "Claude", "Agent", "多模态", "开源"];
  return [...new Set(candidates.filter((tag) => tag === source || tag === category || title.toLowerCase().includes(tag.toLowerCase())))].slice(0, 4);
}

const officialSources = new Set(["OpenAI", "Anthropic", "Meta AI", "Google AI", "Google DeepMind", "Google Research", "Google Cloud AI", "Hugging Face", "AWS · Machine Learning", "NVIDIA · Generative AI", "NVIDIA Developer", "Apple Machine Learning", "GitHub · AI & ML", "Microsoft AI", "Microsoft Research", "IBM AI", "Salesforce AI", "Adobe AI", "Oracle AI", "Intel AI", "Cohere", "Mistral AI", "Stability AI", "Together AI", "Groq", "Cerebras", "Scale AI", "PyTorch", "TensorFlow", "Cloudflare · AI", "Databricks", "Mozilla AI", "Berkeley AI Research", "MIT · AI News", "Stanford HAI", "Allen AI"]);

function importanceFor(item: Pick<NewsItem, "title" | "summary" | "source" | "category" | "related" | "publishedAt">) {
  const text = `${item.title} ${item.summary}`.toLowerCase();
  let score = officialSources.has(item.source) ? 28 : 14;
  if (/正式发布|推出|上线|开源|release|launch|introduc|available now/i.test(text)) score += 24;
  if (/gpt|gemini|claude|deepseek|llama|大模型|基础模型|frontier|foundation model/i.test(text)) score += 16;
  if (/agent|智能体|copilot|编程|coding|多模态|视频生成|机器人/i.test(text)) score += 10;
  if (/价格|定价|计费|降价|融资|收购|监管|安全|芯片|算力|pricing|funding|acqui|regulat|safety|chip/i.test(text)) score += 9;
  score += Math.min(15, Math.max(0, item.related - 1) * 5);
  score = Math.min(100, score);
  const level: NewsItem["level"] = score >= 62 ? "重要" : score >= 42 ? "关注" : "一般";
  const whyImportant = /价格|定价|计费|降价|pricing|cost/i.test(text) ? "可能改变模型使用成本与产品商业化节奏。"
    : /agent|智能体|copilot/i.test(text) ? "反映智能体正进入真实工作流和规模化应用阶段。"
    : /芯片|算力|chip|gpu|infrastructure/i.test(text) ? "将影响 AI 基础设施供给、性能和部署成本。"
    : /监管|安全|regulat|safety|policy/i.test(text) ? "可能影响产品发布边界、合规要求和行业规则。"
    : item.category === "模型发布" ? "新模型能力与开放策略可能重新影响产品和开发者选择。"
    : item.category === "AI 编程" ? "开发工具正在从辅助补全转向覆盖完整软件交付流程。"
    : item.category === "多模态" ? "AI 的交互边界正在从文本进一步扩展到真实内容生产。"
    : "体现 AI 技术正在加速进入具体产品和业务场景。";
  const credibility: NewsItem["credibility"] = officialSources.has(item.source) ? "官方" : /机器之心|新智元|极客公园|钛媒体|36氪|雷峰网|量子位|InfoQ|MIT Technology Review|TechCrunch/i.test(item.source) ? "专业媒体" : "社区";
  const ageDays = Math.max(0, (Date.now() - new Date(item.publishedAt).getTime()) / 86_400_000);
  const freshness: NewsItem["freshness"] = ageDays < 1 ? "刚刚" : ageDays < 3 ? "近期" : "较早";
  if (freshness === "较早") score = Math.max(0, score - 12);
  return { score, level, whyImportant, credibility, freshness };
}

async function fetchSource(source: Source): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const response = await fetch(source.url, { signal: controller.signal, headers: { "user-agent": "AI-Brief/1.0 (+daily-news-reader)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, cf: { cacheTtl: 1800, cacheEverything: true } } as RequestInit & { cf: { cacheTtl: number; cacheEverything: boolean } });
    if (!response.ok) throw new Error(`${source.name}: ${response.status}`);
    const xml = await response.text();
    const atom = source.type === "atom";
    const blocks = xml.match(atom ? /<entry\b[\s\S]*?<\/entry>/gi : /<item\b[\s\S]*?<\/item>/gi) ?? [];
    return blocks.slice(0, source.aiOnly ? 60 : 18).map((block, index) => {
      const title = decode(field(block, "title"));
      const rawSummary = field(block, atom ? "summary" : "description") || field(block, "content:encoded");
      const summary = conciseSummary(rawSummary);
      const publishedAt = decode(field(block, atom ? "published" : "pubDate") || field(block, "updated"));
      const url = link(block, atom);
      const category = classify(title, summary);
      return { id: `${source.mark}-${index}-${publishedAt}`, title, source: source.name, sourceMark: source.mark, publishedAt, category, level: "一般" as const, score: 0, whyImportant: "", summary, imageUrl: imageFrom(block, url), tags: tagsFor(title, source.name, category), url, related: 1 };
    }).filter((item) => item.title && item.url && (!source.aiOnly || /\bai\b|人工智能|大模型|模型|智能体|机器人|算法|芯片|gpt|claude|gemini|deepseek|llm/i.test(`${item.title} ${item.summary}`)));
  } finally { clearTimeout(timer); }
}

export async function GET(request: Request) {
  const requestedSource = new URL(request.url).searchParams.get("source");
  const activeSources = requestedSource ? sources.filter((source) => source.name === requestedSource) : sources;
  if (!activeSources.length) return NextResponse.json({ error: "Unknown source" }, { status: 400 });
  const results = await Promise.allSettled(activeSources.map(fetchSource));
  const failures = results.map((result, index) => result.status === "rejected" ? activeSources[index].name : null).filter(Boolean);
  const all = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const seen = new Map<string, NewsItem>();
  for (const item of all) {
    const key = item.title.toLowerCase().replace(/\s*[-—_|]\s*(?:官方博客|编辑部|老猿ai洞察).*$/i, "").replace(/(?:最新|重磅|突发|官宣|独家)/g, "").replace(/[^a-z0-9\u4e00-\u9fff]/g, "").slice(0, 70);
    const existing = seen.get(key);
    if (existing) existing.related += 1; else seen.set(key, item);
  }
  const items = [...seen.values()].map((item) => ({ ...item, ...importanceFor(item) })).sort((a, b) => (b.score - a.score) || (new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())).slice(0, 600);
  const sourceStatuses = activeSources.map((source, index) => ({ name: source.name, mark: source.mark, type: source.type, homepage: homepageFor(source), itemCount: results[index].status === "fulfilled" ? results[index].value.length : 0, ok: results[index].status === "fulfilled" }));
  return NextResponse.json({ items, updatedAt: new Date().toISOString(), sourceCount: activeSources.length - failures.length, totalSources: activeSources.length, failures, sources: sourceStatuses }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
}
