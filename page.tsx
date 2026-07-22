"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Story = {
  id: string; title: string; source: string; sourceMark: string; publishedAt: string; url: string;
  category: string; level: "重要" | "关注" | "一般"; score?: number; whyImportant?: string; summary: string;
  tags: string[]; related: number; imageUrl?: string; credibility?: "官方" | "专业媒体" | "社区"; freshness?: "刚刚" | "近期" | "较早";
};
type SourceStatus = { name: string; mark: string; type: "rss" | "atom"; homepage: string; itemCount: number; ok: boolean };
type ArticleDetail = { title: string; description: string; publishedAt: string; excerpts: string[]; images: Array<{ url: string; alt: string }>; aiSummary: { overview: string; keyPoints: string[] }; aiGenerated?: boolean; fetchedAt: string };
type DailyInsight = { summary: string; trends: Array<{ title: string; reason: string }>; generatedBy?: string };

const nav = [["✦", "今日简报"], ["◎", "重大事件分析"], ["✧", "AI 问答"], ["♡", "收藏"], ["◉", "数据源管理"]];
const additionalSources = ["Anthropic", "Meta AI", "Microsoft AI", "Google Cloud AI", "NVIDIA Developer", "IBM AI", "Salesforce AI", "Adobe AI", "Oracle AI", "Intel AI", "Hugging Face Papers", "LangChain", "LlamaIndex", "Weights & Biases", "Pinecone", "Weaviate", "Qdrant", "Replicate", "Cohere", "Mistral AI", "Stability AI", "Together AI", "Groq", "Cerebras", "Scale AI", "Stanford HAI", "Allen AI", "IEEE Spectrum · AI", "Ars Technica · AI", "WIRED · AI", "The Verge · AI", "KDnuggets", "Machine Learning Mastery", "SemiAnalysis", "Import AI", "Interconnects", "xAI", "Amazon Science", "Google Developers · AI", "EleutherAI", "LAION", "Open Source Initiative", "机器之心", "新智元", "极客公园", "钛媒体", "少数派", "开源中国", "虎嗅", "极客邦科技", "智东西", "甲子光年", "亿欧网", "创业邦", "雷科技", "极客之选", "科技行者", "arXiv · cs.CV", "arXiv · cs.RO", "arXiv · cs.IR", "arXiv · stat.ML"];
const defaultSources = ["OpenAI", "Google AI", "Google DeepMind", "Google Research", "Hugging Face", "AWS · Machine Learning", "NVIDIA · Generative AI", "Apple Machine Learning", "GitHub · AI & ML", "Microsoft Research", "PyTorch", "TensorFlow", "Cloudflare · AI", "Databricks", "Mozilla AI", "Berkeley AI Research", "MIT · AI News", "MIT Technology Review", "TechCrunch · AI", "VentureBeat · AI", "The Decoder", "雷峰网", "36氪", "IT之家", "博客园", "爱范儿", "量子位", "InfoQ 中文", "arXiv · cs.AI", "arXiv · cs.CL", "arXiv · cs.LG", ...additionalSources];
const legacySources = ["OpenAI", "Google AI", "Hugging Face", "arXiv · cs.AI"];
const expandedSources = ["Apple Machine Learning", "GitHub · AI & ML", "Microsoft Research", "Berkeley AI Research", "MIT · AI News", "MIT Technology Review", "TechCrunch · AI", "VentureBeat · AI", "The Decoder"];
const chineseSources = ["雷峰网", "36氪", "IT之家", "博客园", "爱范儿"];
const latestSources = ["Google Research", "PyTorch", "TensorFlow", "Cloudflare · AI", "Databricks", "Mozilla AI", "量子位", "InfoQ 中文"];
const pageSize = 12;
const sourceGroup = (name: string) => {
  if (["OpenAI", "Anthropic", "Meta AI", "Google AI", "Google DeepMind", "Google Research", "Google Cloud AI", "Google Developers · AI", "Microsoft AI", "Microsoft Research", "Apple Machine Learning", "NVIDIA · Generative AI", "NVIDIA Developer", "AWS · Machine Learning", "IBM AI", "Salesforce AI", "Adobe AI", "Oracle AI", "Intel AI", "Cohere", "Mistral AI", "Stability AI", "Together AI", "Groq", "Cerebras", "Scale AI", "xAI", "Amazon Science", "Berkeley AI Research", "MIT · AI News"].includes(name)) return "官方实验室与企业";
  if (["Hugging Face", "Hugging Face Papers", "GitHub · AI & ML", "PyTorch", "TensorFlow", "Cloudflare · AI", "Databricks", "Mozilla AI", "LangChain", "LlamaIndex", "Weights & Biases", "Pinecone", "Weaviate", "Qdrant", "Replicate"].includes(name)) return "开发者与开源社区";
  if (name.startsWith("arXiv")) return "学术研究";
  if (["雷峰网", "36氪", "IT之家", "博客园", "爱范儿", "量子位", "InfoQ 中文", "机器之心", "新智元", "极客公园", "钛媒体", "少数派", "开源中国", "虎嗅", "极客邦科技", "智东西", "甲子光年", "亿欧网", "创业邦", "雷科技", "极客之选", "科技行者"].includes(name)) return "中文科技媒体";
  return "国际科技媒体";
};
const needsChineseTranslation = (story: Story) => !/[\u4e00-\u9fff]/.test(`${story.title}${story.summary}`);
const formatDate = (value: string) => value ? new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";
const conciseText = (value: string, max = 180) => {
  const sentences = value.match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) ?? [];
  let result = "";
  for (const sentence of sentences) {
    if (result && result.length + sentence.length > max) break;
    if (!result && sentence.length > max) return `${sentence.slice(0, max).replace(/[，,；;：:]?[^，,；;：:]{0,35}$/, "").trim()}。`;
    result += sentence;
    if (result.length >= 90) break;
  }
  return result || value;
};
const highlightKeyText = (value: string) => {
  // A dot inside a version number or product name is not a sentence boundary.
  const sentences = [...value.matchAll(/.*?(?:[。！？!?]+|[.!?](?=\s|$)|$)/g)].filter((match) => match[0].trim());
  const noise = /(?:消息|报道|获悉|讯)[，,:：]?$/;
  const signal = /发布|推出|上线|开放|宣布|升级|突破|首次|增长|下降|提升|降低|支持|将于|正式|完成|获得|超过|达到|融资|收购|开源|免费|停用|调整|进入|加速|转向|意味着|表明|显示|成为|\d+(?:\.\d+)?%|\d+(?:\.\d+)?\s*(?:亿|万|元|美元|参数|倍|款|个)/i;
  const candidates = sentences.map((match, order) => {
    const sentence = match[0];
    const lead = sentence.match(/^\s*(?:(?:据|来自)\s*[^，,。]{1,32}(?:报道|消息|披露)[，,]|(?:IT之家|36氪|雷峰网|爱范儿|量子位|InfoQ(?:\s*中文)?|博客园)[^，,。]{0,28}(?:消息|报道|获悉|讯)[，,])/i)?.[0] ?? "";
    const statement = sentence.slice(lead.length).trimStart();
    const start = (match.index ?? 0) + sentence.indexOf(statement);
    let score = signal.test(statement) ? 3 : 0;
    if (noise.test(statement) || statement.length < 12) score -= 4;
    score -= order * .25;
    return { start, end: start + statement.length, statement, score };
  }).filter((item) => item.statement.length >= 12 && item.statement.length <= 180).sort((a, b) => b.score - a.score);
  const key = candidates[0];
  if (!key || key.score < 3) return <>{value}</>;
  return <>{value.slice(0, key.start)}<strong>{value.slice(key.start, key.end)}</strong>{value.slice(key.end)}</>;
};
const cleanTitle = (title: string, source = "") => {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return title.replace(new RegExp(`\\s*(?:[-—_|·]|\\|)\\s*${escaped}\\s*$`, "i"), "").replace(/\s*[-—_|]\s*(?:老猿AI洞察|小七-七牛开发者|七牛开发者|编辑部|官方博客|科技媒体)\s*$/i, "").trim();
};

const buildDailyInsight = (items: Story[]) => {
  if (!items.length) return "正在阅读今日资讯并形成研判…";
  const themes = [
    { pattern: /agent|智能体|agentic|copilot/i, label: "智能体正从概念验证转向企业工作流和专用基础设施" },
    { pattern: /deepseek|gpt|gemini|claude|模型|model|大模型|llm/i, label: "头部模型继续迭代，能力、开放程度与调用成本成为竞争焦点" },
    { pattern: /价格|定价|计费|降价|成本|price|pricing|token/i, label: "模型价格与算力成本持续下探，应用落地门槛进一步降低" },
    { pattern: /相机|手机|硬件|芯片|机器人|端侧|device|camera|robot|chip/i, label: "端侧 AI 正加速进入智能硬件和真实使用场景" },
    { pattern: /多模态|视频|图像|语音|multimodal|video|image|voice/i, label: "多模态能力继续向视频、图像和实时交互扩展" },
    { pattern: /编程|代码|开发者|coding|code|developer/i, label: "AI 编程工具的竞争重心正在转向完整开发流程" },
    { pattern: /开源|open.?source|github/i, label: "开源生态仍在加速缩小与闭源产品的能力差距" },
  ];
  const weight = { 重要: 3, 关注: 2, 一般: 1 };
  const ranked = themes.map((theme) => ({ ...theme, score: items.reduce((sum, item) => sum + (theme.pattern.test(`${item.title} ${item.summary}`) ? weight[item.level] : 0), 0) })).filter((theme) => theme.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
  if (!ranked.length) return "今天的 AI 动态以产品落地和产业应用为主，行业关注点正从单一能力竞赛转向可用性、成本与真实业务价值。";
  const [first, ...rest] = ranked;
  return `今天最值得关注的主线是：${first.label}；${rest.map((theme) => theme.label).join("，同时，")}。整体来看，行业竞争正从单点能力展示转向可规模化落地。`;
};

export default function Home() {
  const [active, setActive] = useState("今日简报");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部分类");
  const [level, setLevel] = useState("全部级别");
  const [sort, setSort] = useState("综合排序");
  const [view, setView] = useState<"cards" | "list">("cards");
  const [saved, setSaved] = useState<string[]>([]);
  const [savedStories, setSavedStories] = useState<Record<string, Story>>({});
  const [readHistory, setReadHistory] = useState<string[]>([]);
  const [readFilter, setReadFilter] = useState("全部阅读");
  const [storyFolders, setStoryFolders] = useState<Record<string, string>>({});
  const [folderFilter, setFolderFilter] = useState("全部文件夹");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [answering, setAnswering] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [sourceStatuses, setSourceStatuses] = useState<SourceStatus[]>([]);
  const [enabledSources, setEnabledSources] = useState<string[] | null>(null);
  const [syncingSource, setSyncingSource] = useState("");
  const [selected, setSelected] = useState<Story | null>(null);
  const [articleDetail, setArticleDetail] = useState<ArticleDetail | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState("");
  const [toast, setToast] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [storyTranslations, setStoryTranslations] = useState<Record<string, { title: string; summary: string }>>({});
  const [showChinese, setShowChinese] = useState(false);
  const [translatingPage, setTranslatingPage] = useState(false);
  const [page, setPage] = useState(1);
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("全部状态");
  const [dailyInsight, setDailyInsight] = useState<DailyInsight | null>(null);
  const [expandedTrend, setExpandedTrend] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const loadNews = useCallback(async (source = "") => {
    setLoading(true); setError("");
    try {
      if (source) setSyncingSource(source);
      const params = new URLSearchParams({ t: String(Date.now()) });
      if (source) params.set("source", source);
      const response = await fetch(`/api/news?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("抓取服务暂时不可用");
      const data = await response.json() as { items: Story[]; updatedAt: string; sources: SourceStatus[] };
      setStories((current) => source ? [...current.filter((item) => item.source !== source), ...data.items] : data.items);
      setUpdatedAt(data.updatedAt);
      setSourceStatuses((current) => source ? [...current.filter((item) => item.name !== source), ...data.sources] : data.sources);
      if (source) notify(`${source} 已同步`);
    } catch { setError("暂时无法获取最新资讯，请稍后重试。 "); }
    finally { setLoading(false); setSyncingSource(""); }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("ai-brief-saved");
    if (stored) setSaved(JSON.parse(stored));
    const storedStories = window.localStorage.getItem("ai-brief-saved-stories");
    if (storedStories) setSavedStories(JSON.parse(storedStories));
    const storedHistory = window.localStorage.getItem("ai-brief-read-history");
    if (storedHistory) setReadHistory(JSON.parse(storedHistory));
    const storedFolders = window.localStorage.getItem("ai-brief-story-folders");
    if (storedFolders) setStoryFolders(JSON.parse(storedFolders));
    const storedSources = window.localStorage.getItem("ai-brief-enabled-sources");
    const sourceVersion = window.localStorage.getItem("ai-brief-source-version");
    const storedEnabled = storedSources ? JSON.parse(storedSources) as string[] : defaultSources;
    const previousMigration = sourceVersion === "5" ? storedEnabled : sourceVersion === "4" ? [...new Set([...storedEnabled, ...latestSources])] : sourceVersion === "3" ? [...new Set([...storedEnabled, ...chineseSources, ...latestSources])] : sourceVersion === "2" ? [...new Set([...storedEnabled, ...expandedSources, ...chineseSources, ...latestSources])] : [...new Set([...storedEnabled, ...defaultSources.filter((name) => !legacySources.includes(name))])];
    const migratedSources = sourceVersion === "6" ? storedEnabled : [...new Set([...previousMigration, ...additionalSources])];
    setEnabledSources(migratedSources);
    window.localStorage.setItem("ai-brief-source-version", "6");
    setStorageReady(true);
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setSearchOpen(true); }
      if (event.key === "Escape") { setSelected(null); setSearchOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { if (storageReady) window.localStorage.setItem("ai-brief-saved", JSON.stringify(saved)); }, [saved, storageReady]);
  useEffect(() => { if (storageReady) window.localStorage.setItem("ai-brief-saved-stories", JSON.stringify(savedStories)); }, [savedStories, storageReady]);
  useEffect(() => { if (storageReady) window.localStorage.setItem("ai-brief-read-history", JSON.stringify(readHistory.slice(-200))); }, [readHistory, storageReady]);
  useEffect(() => { if (storageReady) window.localStorage.setItem("ai-brief-story-folders", JSON.stringify(storyFolders)); }, [storyFolders, storageReady]);
  useEffect(() => {
    if (!storageReady || !stories.length || !saved.length) return;
    setSavedStories((current) => {
      const next = { ...current }; let changed = false;
      for (const id of saved) {
        if (next[id]) continue;
        const exact = stories.find((story) => story.id === id);
        const legacy = id.match(/^(.+?)-\d+-(.+)$/);
        const recovered = exact ?? (legacy ? stories.find((story) => story.sourceMark === legacy[1] && story.publishedAt === legacy[2]) : undefined);
        if (recovered) { next[id] = { ...recovered, id }; changed = true; }
      }
      return changed ? next : current;
    });
  }, [stories, saved, storageReady]);
  useEffect(() => { if (enabledSources) window.localStorage.setItem("ai-brief-enabled-sources", JSON.stringify(enabledSources)); }, [enabledSources]);
  useEffect(() => { void loadNews(); }, [loadNews]);
  useEffect(() => {
    if (!selected) { setArticleDetail(null); setArticleError(""); return; }
    const controller = new AbortController();
    setArticleLoading(true); setArticleDetail(null); setArticleError("");
    fetch(`/api/article?url=${encodeURIComponent(selected.url)}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("fetch failed"); return response.json() as Promise<ArticleDetail>; })
      .then(setArticleDetail).catch((error) => { if (error instanceof Error && error.name !== "AbortError") setArticleError("原文页面暂时无法读取，已保留来源提供的摘要信息。"); })
      .finally(() => { if (!controller.signal.aborted) setArticleLoading(false); });
    return () => controller.abort();
  }, [selected]);

  const availableStories = useMemo(() => active === "收藏" ? [...new Map([...Object.values(savedStories), ...stories].map((story) => [story.id, story])).values()] : stories, [active, savedStories, stories]);
  const filtered = useMemo(() => availableStories.filter((s) => {
    const matchQuery = `${s.title}${s.summary}${s.tags.join("")}`.toLowerCase().includes(query.toLowerCase());
    const matchCategory = category === "全部分类" || s.category === category;
    const matchLevel = level === "全部级别" || s.level === level;
    const matchSaved = active !== "收藏" || saved.includes(s.id);
    const matchRead = readFilter === "全部阅读" || (readFilter === "未读" ? !readHistory.includes(s.id) : readHistory.includes(s.id));
    const matchFolder = folderFilter === "全部文件夹" || storyFolders[s.id] === folderFilter;
    const matchSource = active === "收藏" || (enabledSources ?? defaultSources).includes(s.source);
    const ageDays = Math.max(0, (Date.now() - new Date(s.publishedAt).getTime()) / 86_400_000);
    const matchRecency = active === "收藏" || ageDays <= (active === "今日简报" ? 14 : 45);
    return matchQuery && matchCategory && matchLevel && matchSaved && matchRead && matchFolder && matchSource && matchRecency;
  }).sort((a, b) => {
    if (sort === "综合排序") {
      const combined = (story: Story) => {
        const importance = story.score ?? { 重要: 75, 关注: 50, 一般: 25 }[story.level];
        const ageHours = Math.max(0, (Date.now() - new Date(story.publishedAt).getTime()) / 3_600_000);
        return importance + Math.max(0, 42 - ageHours / 8);
      };
      return combined(b) - combined(a) || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    }
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  }), [availableStories, query, category, level, sort, active, saved, readFilter, readHistory, folderFilter, storyFolders, enabledSources]);

  const currentPageSize = active === "今日简报" ? 9 : pageSize;
  const totalPages = Math.max(1, Math.ceil(filtered.length / currentPageSize));
  const pagedStories = filtered.slice((page - 1) * currentPageSize, page * currentPageSize);
  useEffect(() => { setPage(1); setShowChinese(false); }, [query, category, level, sort, active, readFilter]);
  const briefStories = useMemo(() => [...pagedStories].sort((a, b) => {
      const weight = { 重要: 3, 关注: 2, 一般: 1 };
      return weight[b.level] - weight[a.level] || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    }).slice(0, 6), [pagedStories]);
  const briefSummary = useMemo(() => buildDailyInsight(filtered.slice(0, 80)), [filtered]);

  useEffect(() => {
    if (loading || filtered.length < 3 || active !== "今日简报") return;
    const controller = new AbortController();
    fetch("/api/insight", { method: "POST", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() as Promise<DailyInsight> : null)
      .then((value) => { if (value?.summary) setDailyInsight(value); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [loading, active, filtered]);

  useEffect(() => {
    const cards = Array.from(document.querySelectorAll<HTMLElement>(".story-card"));
    if (!cards.length) return;
    if (!("IntersectionObserver" in window)) { cards.forEach((card) => card.classList.add("in-view")); return; }
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add("in-view"); observer.unobserve(entry.target); }
    }), { threshold: .12 });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [pagedStories, active, view]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2200); };
  const toggleSaved = (story: Story) => {
    const removing = saved.includes(story.id);
    setSaved((items) => removing ? items.filter((id) => id !== story.id) : [...items, story.id]);
    setSavedStories((items) => {
      if (!removing) return { ...items, [story.id]: story };
      const next = { ...items }; delete next[story.id]; return next;
    });
  };
  const clearFilters = () => { setCategory("全部分类"); setLevel("全部级别"); setQuery(""); };
  const changeSection = (label: string) => { setActive(label); setSelected(null); setMenuOpen(false); clearFilters(); };
  const toggleSource = (name: string) => setEnabledSources((current) => {
    const enabled = current ?? defaultSources;
    const next = enabled.includes(name) ? enabled.filter((item) => item !== name) : [...enabled, name];
    notify(enabled.includes(name) ? `${name} 已停用` : `${name} 已启用`);
    return next;
  });
  const translateCurrentPage = async (silent = false) => {
    const allTranslated = pagedStories.every((story) => !needsChineseTranslation(story) || storyTranslations[story.id]);
    if (showChinese && allTranslated) { setShowChinese(false); return; }
    if (allTranslated) { setShowChinese(true); return; }
    setTranslatingPage(true);
    try {
      const translateText = async (text: string) => {
        const response = await fetch("/api/translate", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, direction: "en-zh" }) });
        const data = await response.json() as { translatedText?: string; error?: string };
        if (!response.ok || !data.translatedText) throw new Error(data.error || "翻译失败");
        return data.translatedText;
      };
      const missing = pagedStories.filter((story) => needsChineseTranslation(story) && !storyTranslations[story.id]);
      const completed: Record<string, { title: string; summary: string }> = {};
      let failedCount = 0;
      for (let index = 0; index < missing.length; index += 2) {
        await Promise.all(missing.slice(index, index + 2).map(async (story) => {
          try {
            const separator = "[[[AI_BRIEF_SPLIT]]]";
            const translated = await translateText(`${story.title}\n${separator}\n${story.summary}`);
            const [title, summary] = translated.split(separator).map((part) => part.trim());
            if (!title || !summary) throw new Error("翻译结果格式异常");
            completed[story.id] = { title, summary };
          } catch { failedCount += 1; }
        }));
        setStoryTranslations((current) => ({ ...current, ...completed }));
      }
      if (!Object.keys(completed).length) throw new Error("翻译服务暂时不可用，请稍后重试");
      setShowChinese(true);
      if (!silent) notify(failedCount ? `已翻译 ${Object.keys(completed).length} 条，${failedCount} 条可点击重试` : "本页资讯已转换为中文");
    } catch (error) { if (!silent) notify(error instanceof Error ? error.message : "翻译服务暂时不可用"); }
    finally { setTranslatingPage(false); }
  };
  const pageTranslationKey = pagedStories.map((story) => story.id).join("|");
  useEffect(() => {
    if (!loading && pagedStories.length) void translateCurrentPage(true);
    // A new result page should default to Chinese; manual language toggles do not change this key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageTranslationKey, loading]);
  const pageCopy: Record<string, [string, string]> = {
    "今日简报": ["今日简报", ""], "重大事件分析": ["重大事件分析", "把同一事件放进时间线，查看从披露到落地的完整过程"], "AI 问答": ["AI 问答", "只基于当前已抓取的资讯回答，并附上可追溯来源"],
    "收藏": ["收藏", `已保存 ${saved.length} 条 · 已读 ${readHistory.length} 条 · ${Object.keys(storyFolders).length} 条已归类`],
    "数据源管理": ["数据源管理", `已启用 ${(enabledSources ?? defaultSources).length} / ${sourceStatuses.length || defaultSources.length} 个公开来源`],
  };
  const currentCopy = pageCopy[active] ?? [active, "管理数据采集、处理与发布状态"];
  const selectedTranslation = selected && showChinese ? storyTranslations[selected.id] : null;
  const detailPoints = selected ? (articleDetail?.aiSummary.keyPoints.length ? articleDetail.aiSummary.keyPoints : (selectedTranslation?.summary || selected.summary).match(/[^。！？.!?]+[。！？.!?]+|[^。！？.!?]+$/g)?.map((point) => point.trim()).filter(Boolean).slice(0, 3) ?? []) : [];
  const todayLabel = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date());
  const visibleSources = sourceStatuses.filter((source) => {
    const enabled = (enabledSources ?? defaultSources).includes(source.name);
    const queryMatch = source.name.toLowerCase().includes(sourceQuery.toLowerCase());
    const statusMatch = sourceFilter === "全部状态" || (sourceFilter === "连接异常" && !source.ok) || (sourceFilter === "已暂停" && !enabled) || (sourceFilter === "采集中" && enabled && source.ok);
    return queryMatch && statusMatch;
  });
  const groupedSources = [...new Set(visibleSources.map((source) => sourceGroup(source.name)))].map((group) => ({ group, sources: visibleSources.filter((source) => sourceGroup(source.name) === group) }));
  const eventStories = [...stories].filter((story) => story.level !== "一般" || story.related > 1).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);
  const answerStories = [...stories].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 5);
  const askQuestion = () => { if (!question.trim() || answering) return; setAnswering(true); setAnswer(""); window.setTimeout(() => { const focus = question.includes("开发者") ? answerStories.filter((story) => /开发|编程|开源|模型|agent|智能体/i.test(`${story.title}${story.summary}`)) : answerStories; const selectedAnswers = (focus.length ? focus : answerStories).slice(0, 4); setAnswer(selectedAnswers.map((story, index) => `${index + 1}. ${story.title}：${story.whyImportant || "这条资讯可能影响产品方向、技术选型或开发者工作流。"}`).join("\n")); setAnswering(false); }, 520); };
  const setVisibleSources = (enabled: boolean) => setEnabledSources((current) => {
    const existing = current ?? defaultSources;
    const names = new Set(visibleSources.map((source) => source.name));
    const next = enabled ? [...new Set([...existing, ...names])] : existing.filter((name) => !names.has(name));
    notify(enabled ? `已启用 ${names.size} 个当前来源` : `已暂停 ${names.size} 个当前来源`); return next;
  });
  const openStory = (story: Story) => { setSelected(story); setReadHistory((current) => [...new Set([...current, story.id])]); };
  return (
    <main className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <div className="brand"><span className="brand-logo"><img src="/ai-brief-logo-v2.png" alt="" /><span className="brand-logo-orbit" aria-hidden="true">✦</span></span><span className="brand-wordmark"><span>AI</span><b>Brief</b></span></div>
        <nav aria-label="主导航">
          <p className="nav-label">工作台</p>
          {nav.map(([icon, label]) => <button key={label} className={active === label ? "active" : ""} onClick={() => changeSection(label)}><i>{icon}</i>{label}{label === "收藏" && saved.length > 0 && <em>{saved.length}</em>}</button>)}
        </nav>
        <div className="profile"><div className="avatar">周</div><div><b>周 玉川</b><small>管理员</small></div></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "关闭导航菜单" : "打开导航菜单"}>☰</button>
          <button className="global-search" onClick={() => setSearchOpen(true)} aria-label="打开资讯搜索"><span>⌕</span><span className="global-search-placeholder">搜索资讯、公司、产品或模型…</span><kbd>⌘ K</kbd></button>
          <button className="refresh primary-refresh" onClick={() => void loadNews()} disabled={loading}>↻ <span>{loading ? "更新中" : "刷新"}</span></button>
        </header>

        {searchOpen && <div className="search-overlay" role="dialog" aria-modal="true" aria-label="资讯搜索">
          <button className="search-overlay-backdrop" onClick={() => setSearchOpen(false)} aria-label="关闭搜索" />
          <section className="search-panel">
            <div className="search-panel-head"><span>资讯搜索</span><button onClick={() => setSearchOpen(false)} aria-label="关闭搜索">×</button></div>
            <label className="search-panel-input"><span>⌕</span><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索公司、模型、产品或行业事件…" /><kbd>Esc</kbd></label>
            <div className="search-suggestions"><span>热门追踪</span>{["DeepSeek", "AI Agent", "AI 编程", "模型发布", "多模态"].map((term) => <button key={term} onClick={() => { setQuery(term); setSearchOpen(false); }}>{term}</button>)}</div>
            <p>搜索会在当前聚合的资讯中即时筛选。</p>
          </section>
        </div>}

        <div className="content">
          <div className="page-heading">
            <div><p className="eyebrow">AI BRIEF · {todayLabel}</p><h1><span>{currentCopy[0]}</span><i aria-hidden="true">✦</i></h1>{currentCopy[1] && <p>{currentCopy[1]}</p>}</div>
            <div className="updated"><span className="live-dot"/>更新于 {formatDate(updatedAt)}</div>
          </div>

          {active === "今日简报" && <section className="daily-brief">
            <div className="brief-main"><div className="spark">✦</div><div><div className="brief-title"><span>今日 AI 一句话总结</span><small>{dailyInsight ? "大模型生成" : "智能提炼"}</small></div><p className="summary-copy">{dailyInsight?.summary || briefSummary}</p><div className="summary-signals"><span><i>01</i> 模型能力</span><span><i>02</i> 场景落地</span><span><i>03</i> 成本变化</span></div></div></div>
            <div className="trend-list"><span className="trend-label">今日核心趋势</span>{dailyInsight?.trends?.length ? dailyInsight.trends.slice(0, 6).map((trend, index) => <button className={`trend-item ${expandedTrend === index ? "expanded" : ""}`} key={`${trend.title}-${index}`} onClick={() => setExpandedTrend((current) => current === index ? null : index)}><b>0{index + 1}</b><span className="trend-copy"><span className="trend-title">{trend.title}</span><small>{trend.reason}</small></span><i>{expandedTrend === index ? "−" : "+"}</i></button>) : briefStories.map((story, index) => <button key={story.id} onClick={() => setSelected(story)}><b>0{index + 1}</b><span className="trend-title">{cleanTitle(storyTranslations[story.id]?.title || (!needsChineseTranslation(story) ? story.title : "正在提炼趋势…"), story.source)}</span><i>↗</i></button>)}</div>
          </section>}

          {active === "重大事件分析" && <section className="event-board"><div className="event-board-head"><div><span className="eyebrow">EVENT TIMELINE</span><h2>值得持续跟踪的事件</h2></div><span>{eventStories.length} 个事件</span></div>{eventStories.map((story) => <article className="event-card" key={story.id} onClick={() => openStory(story)}><div className="event-card-title"><b>{story.title}</b><span className={`credibility ${story.credibility || "专业媒体"}`}>{story.credibility || "专业媒体"}</span></div><div className="event-line"><div><i>01</i><b>首次披露</b><span>{formatDate(story.publishedAt)}</span></div><div><i>02</i><b>多源确认</b><span>{story.related > 1 ? `已有 ${story.related} 个来源报道` : "等待更多来源交叉验证"}</span></div><div><i>03</i><b>后续影响</b><span>{story.whyImportant || "持续观察产品、行业与开发者影响"}</span></div></div></article>)}</section>}
          {active === "数据源管理" && <section className="source-manager">
            <div className="source-toolbar"><div><b>抓取来源</b><p>停用后，该来源的内容会立即从资讯流中隐藏；设置保存在当前设备。</p></div><button onClick={() => void loadNews()} disabled={loading}>↻ {loading ? "同步中" : "全部同步"}</button></div>
            <div className="source-controls"><div className="source-search"><span>⌕</span><input value={sourceQuery} onChange={(event) => setSourceQuery(event.target.value)} placeholder="搜索数据源…" /></div><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="数据源状态"><option>全部状态</option><option>采集中</option><option>已暂停</option><option>连接异常</option></select><span>{visibleSources.length} 个来源</span><button onClick={() => setVisibleSources(true)}>批量启用</button><button onClick={() => setVisibleSources(false)}>批量暂停</button></div>
            {groupedSources.map(({ group, sources: groupItems }) => <section className="source-group" key={group}><div className="source-group-title"><h2>{group}</h2><span>{groupItems.length}</span></div><div className="source-grid">{groupItems.map((source) => {
              const enabled = (enabledSources ?? defaultSources).includes(source.name);
              return <article className={`source-card ${enabled ? "" : "disabled"}`} key={source.name}>
                <div className="source-card-head"><span className="source-logo">{source.mark}</span><div><h2>{source.name}</h2><p>{source.type.toUpperCase()} · {source.ok ? "连接正常" : "连接失败"}</p></div><span className={`source-health ${source.ok ? "ok" : "bad"}`}>{source.ok ? "正常" : "异常"}</span></div>
                <div className="source-metrics"><div><b>{source.itemCount}</b><span>本次获取</span></div><div><b>{enabled ? "采集中" : "已暂停"}</b><span>当前状态</span></div></div>
                <div className="source-actions"><button className="sync-source" onClick={() => void loadNews(source.name)} disabled={loading}>↻ {syncingSource === source.name ? "同步中" : "单独同步"}</button><a className="source-link" href={source.homepage} target="_blank" rel="noreferrer">访问来源 ↗</a><label className="source-switch"><input type="checkbox" checked={enabled} onChange={() => toggleSource(source.name)} /><span/><em>{enabled ? "已启用" : "已停用"}</em></label></div>
              </article>;
            })}</div></section>)}
            {!visibleSources.length && <div className="source-empty">没有符合条件的数据源</div>}
          </section>}

          {active === "AI 问答" && <section className="qa-board"><div className="qa-intro"><span className="qa-icon">✧</span><div><h2>问问今天的 AI 世界</h2><p>回答仅基于当前已抓取资讯，不编造站外信息。</p></div></div><div className="qa-input"><input value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") askQuestion(); }} placeholder="例如：今天哪些消息会影响开发者？" /><button onClick={askQuestion} disabled={!question.trim() || answering}>{answering ? "分析中…" : "提问"}</button></div><div className="qa-suggestions">{["今天哪些消息会影响开发者？", "最近模型能力有什么变化？", "哪些资讯值得重点跟进？"].map((item) => <button key={item} onClick={() => setQuestion(item)}>{item}</button>)}</div>{answer && <div className="qa-answer"><div className="qa-answer-head"><b>AI 分析</b><span>基于当前资讯</span></div><div className="qa-answer-text">{answer.split("\n").map((line) => <p key={line}>{line}</p>)}</div><div className="qa-sources"><b>引用来源</b>{answerStories.slice(0, 4).map((story) => <a key={story.id} href={story.url} target="_blank" rel="noreferrer">{story.source} · {story.title} ↗</a>)}</div></div>}</section>}
          {active !== '数据源管理' && active !== "重大事件分析" && active !== "AI 问答" && <><section className="filters">
            <div className="filter-row">
              <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="资讯分类"><option>全部分类</option><option>模型发布</option><option>AI Agent</option><option>AI 编程</option><option>多模态</option><option>开源项目</option><option>学术研究</option><option>行业动态</option></select>
              <select value={level} onChange={(e) => setLevel(e.target.value)} aria-label="重要程度"><option>全部级别</option><option>重要</option><option>关注</option><option>一般</option></select>
              <select value={readFilter} onChange={(e) => setReadFilter(e.target.value)} aria-label="阅读状态"><option>全部阅读</option><option>未读</option><option>已读</option></select>{active === "收藏" && <select value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)} aria-label="收藏文件夹"><option>全部文件夹</option><option>模型</option><option>产品</option><option>行业</option><option>待阅读</option></select>}
              <div className="sort-toggle" aria-label="排序方式"><button className={sort === "综合排序" ? "active" : ""} onClick={() => setSort("综合排序")}>重要优先</button><button className={sort === "时间优先" ? "active" : ""} onClick={() => setSort("时间优先")}>时间优先</button></div>
              {(category !== "全部分类" || level !== "全部级别" || query) && <button className="clear" onClick={clearFilters}>清除筛选 ×</button>}
            </div>
            <div className="view-row"><p>{`共 ${filtered.length} 条资讯 · 第 ${page} / ${totalPages} 页`}</p><div className="view-tools"><button className="translate-page" onClick={() => void translateCurrentPage()} disabled={translatingPage || !pagedStories.length}>译 {translatingPage ? "正在转换中文…" : showChinese && pagedStories.every((story) => !needsChineseTranslation(story) || storyTranslations[story.id]) ? "查看英文" : "显示中文"}</button>{active === "今日简报" ? <div className="view-switch"><button className={view === "cards" ? "active" : ""} onClick={() => setView("cards")} aria-label="卡片视图">▦</button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="列表视图">☷</button></div> : <span className="stream-label">精简时间线</span>}</div></div>
          </section>

          <section className={`stories ${view === "list" ? "compact" : ""}`}>
            {loading && <div className="loading-state"><span/><span/><span/></div>}
            {error && !loading && <div className="empty error-state"><span>!</span><h3>资讯获取失败</h3><p>{error}</p><button onClick={() => void loadNews()}>重新获取</button></div>}
            {!loading && !error && filtered.length === 0 && <div className="empty"><span>{active === "收藏" ? "♡" : "⌕"}</span><h3>{active === "收藏" && saved.length === 0 ? "还没有收藏的资讯" : "没有找到匹配的资讯"}</h3><p>{active === "收藏" && saved.length === 0 ? "在资讯卡片右上角点击爱心，即可保存到这里" : "试试更换关键词或清除筛选条件"}</p>{active === "收藏" && (saved.length === 0 ? <button onClick={() => changeSection("资讯流")}>浏览资讯流</button> : <button onClick={clearFilters}>清除筛选</button>)}</div>}
            {!loading && !error && pagedStories.map((story, index) => { const translated = showChinese ? storyTranslations[story.id] : null; return <article tabIndex={0} role="button" aria-label={`查看详情：${translated?.title || story.title}`} className={`story-card ${index === 0 && active === "今日简报" ? "featured" : ""}`} style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }} key={story.id} onClick={() => openStory(story)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStory(story); } }}>
              {index === 0 && active === "今日简报" ? <div className="featured-mark">今日重点</div> : story.freshness === "刚刚" ? <div className="story-mark fresh-mark">刚刚更新</div> : story.category === "学术研究" ? <div className="story-mark deep-mark">深度阅读</div> : null}
              <div className="story-top"><div className="source-mark">{story.sourceMark}</div><div className="story-meta"><b>{story.source}</b><span>{formatDate(story.publishedAt)}</span></div><span className={`credibility ${story.credibility || "专业媒体"}`}>{story.credibility || "专业媒体"}</span><div className={`importance ${story.level}`}>{story.level === "重要" ? "◆" : "●"} {story.level}</div><button className={`save ${saved.includes(story.id) ? "saved" : ""}`} onClick={(e) => { e.stopPropagation(); toggleSaved(story); }} aria-label={saved.includes(story.id) ? "取消收藏" : "收藏"}>{saved.includes(story.id) ? "♥" : "♡"}</button></div>
              {story.imageUrl && <div className="story-media"><img src={story.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.parentElement?.classList.add("media-error"); }} /></div>}
              <div className="story-body"><h2>{cleanTitle(translated?.title || story.title, story.source)}</h2><div className="story-tags"><span className="category">{story.category}</span>{story.tags.filter((tag) => tag !== story.source && tag !== story.category).slice(0, 1).map((tag) => <span key={tag}>{tag}</span>)}</div><p>{highlightKeyText(conciseText(translated?.summary || story.summary))}</p></div>
              <div className="story-footer"><div>{story.related > 1 && <span>▱ 已合并 {story.related} 篇重复报道</span>}{active === "收藏" && <button onClick={(e) => { e.stopPropagation(); const folder = window.prompt("归入文件夹：模型 / 产品 / 行业 / 待阅读", storyFolders[story.id] || "待阅读"); if (folder && ["模型", "产品", "行业", "待阅读"].includes(folder)) setStoryFolders((current) => ({ ...current, [story.id]: folder })); }}>▤ {storyFolders[story.id] || "归类"}</button>}</div><div><button className="details">查看摘要 →</button></div></div>
            </article>})}
          </section></>}
          {active !== "数据源管理" && !loading && !error && filtered.length > currentPageSize && <nav className="pagination" aria-label="资讯分页"><button onClick={() => { setPage((current) => Math.max(1, current - 1)); setShowChinese(false); }} disabled={page === 1}>← 上一页</button><span>{page} / {totalPages}</span><button onClick={() => { setPage((current) => Math.min(totalPages, current + 1)); setShowChinese(false); }} disabled={page === totalPages}>下一页 →</button></nav>}
        </div>
      </section>

      {selected && <><div className="backdrop" onClick={() => setSelected(null)} /><aside className="drawer" aria-label="资讯详情">
        <div className="drawer-head"><span>资讯详情</span><button onClick={() => setSelected(null)} aria-label="关闭资讯详情">×</button></div>
        <div className="drawer-content"><div className="drawer-meta"><span className={`importance ${selected.level}`}>◆ {selected.level}</span><span>{selected.category}</span></div><h2>{cleanTitle(selectedTranslation?.title || selected.title, selected.source)}</h2><p className="origin">{selected.source} · {formatDate(selected.publishedAt)}</p>
          <div className="drawer-section article-content"><h3>原文信息</h3>
            {articleLoading && <div className="article-loading"><span/><span/><span/></div>}
            {!articleLoading && (articleDetail?.images.length || selected.imageUrl) ? <div className={`article-images ${(articleDetail?.images.length || (selected.imageUrl ? 1 : 0)) === 1 ? "single" : ""}`}>{(articleDetail?.images.length ? articleDetail.images : selected.imageUrl ? [{ url: selected.imageUrl, alt: selected.title }] : []).map((image, index) => <img key={image.url} src={image.url} alt={image.alt || `${articleDetail?.title || selected.title} 配图 ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.style.display = "none"; }} />)}</div> : null}
            {!articleLoading && <p>{selectedTranslation?.summary || articleDetail?.description || selected.summary}</p>}
            {articleDetail?.excerpts.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {articleDetail && <small>已于 {formatDate(articleDetail.fetchedAt)} 从原文页面提取</small>}
          </div>
          <div className="drawer-section ai-summary"><div className="ai-summary-title"><span>✦</span><div><h3>AI 摘要</h3><small>{articleDetail?.aiGenerated ? "大模型阅读全文生成" : "基于原文智能提炼"}</small></div></div>
            {articleLoading ? <p>正在阅读原文并生成摘要…</p> : <><p>{highlightKeyText(selectedTranslation?.summary || articleDetail?.aiSummary.overview || selected.summary)}</p>{detailPoints.length ? <><h4>关键信息</h4><ul>{detailPoints.map((point, index) => <li key={index}><b>0{index + 1}</b><span>{highlightKeyText(point)}</span></li>)}</ul></> : null}</>}
          </div>
          <div className="drawer-actions"><button onClick={() => toggleSaved(selected)}>{saved.includes(selected.id) ? "♥ 已收藏" : "♡ 收藏"}</button><a className="primary" href={selected.url} target="_blank" rel="noreferrer">阅读原文 ↗</a></div>
        </div>
      </aside></>}
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
