"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Story = {
  id: string; title: string; source: string; sourceMark: string; publishedAt: string; url: string;
  category: string; level: "重要" | "关注" | "一般"; score: number; trustScore: number;
  trustLabel: "高可信" | "较可信" | "待核实"; summary: string; tags: string[];
  related: number; sourceMentions: string[]; imageUrl?: string;
};
type SourceStatus = {
  name: string; mark: string; homepage: string; type: string; chinese: boolean;
  trustScore: number; ok: boolean; itemCount: number;
};
type ChatMessage = { role: "user" | "assistant"; content: string; citations?: Array<{ title: string; source: string; url: string }>; followUps?: string[] };
type Translation = { title: string; summary: string; target: "zh" | "en" };
type ArticleDetail = { title: string; description: string; imageUrl?: string; siteName?: string; author?: string; publishedAt?: string; aiSummary: string; keyPoints: string[]; paragraphs: string[] };

const nav = [
  { icon: "▦", label: "今日资讯" },
  { icon: "✦", label: "AI 问答" },
  { icon: "♡", label: "我的收藏" },
  { icon: "◉", label: "数据源网络" },
];
const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "刚刚" : new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
};
const relative = (value: string) => {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  if (diff < 3_600_000) return `${Math.max(1, Math.round(diff / 60_000))} 分钟前`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)} 小时前`;
  return `${Math.round(diff / 86_400_000)} 天前`;
};
const isEnglish = (story: Story) => !/[\u4e00-\u9fff]/.test(`${story.title}${story.summary}`);
const oneSentence = (value = "") => value.match(/^[\s\S]*?[。！？.!?]/)?.[0]?.trim() || value.trim();
const completeSummary = (value = "") => {
  const text = value.replace(/\s*(?:\.{3,}|…+)\s*$/g, "").trim();
  if (!text) return "原文暂未提供摘要，可进入详情查看已抓取的信息。";
  return /[。！？.!?]$/.test(text) ? text : `${text}。`;
};
const cleanDisplayTitle = (value = "", source = "") => {
  let text = value.replace(/(?:\.{3,}|…+)/g, " ").replace(/\s+/g, " ").trim();
  const aliases = [source, source.replace(/\s*(?:科技|新闻|中文|AI|人工智能|开发者社区|开发者|研究院|实验室|学院)$/i, "")].filter((name) => name.length >= 2);
  aliases.forEach((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\s*(?:[-—–_|｜]|·)\\s*${escaped}\\s*$`, "i"), "").trim();
  });
  return text.replace(/\s*(?:[-—–_|｜]|·)\s*(?:光明网|新华网|人民网|中国新闻网|央视网|澎湃新闻|品玩|量子位|机器之心|雷峰网|(?:www\.)?[\w.-]+\.(?:com|cn|net|org)(?:\.cn)?)\s*$/i, "").trim();
};
const sourceCategory = (source: SourceStatus) => {
  const name = source.name.toLowerCase();
  if (/arxiv|mit|research|研究院|实验室|lab|科学院|科学报|papers|stanford|berkeley|智源|之江/.test(name)) return "学术研究";
  if (/openai|anthropic|deepmind|meta ai|nvidia|apple|ibm|salesforce|adobe|stability|mistral|cohere|xai|deepseek|智谱|百川|月之暗面|minimax|零一万物|商汤|讯飞|达摩院|noah|腾讯 ai/.test(name)) return "官方与实验室";
  if (/开发|github|hugging face|csdn|掘金|segment|cloud|云|langchain|llamaindex|vercel|mongodb|databricks|snowflake|replicate|together/.test(name)) return "开发者社区";
  return source.chinese ? "中文科技媒体" : "国际科技媒体";
};
const sourceCategories = ["全部来源", "中文科技媒体", "官方与实验室", "学术研究", "开发者社区", "国际科技媒体"];
const topicOptions = ["模型发布", "AI Agent", "AI 编程", "中国 AI", "融资", "多模态", "开源项目"];
const matchesTopic = (story: Story, topic: string) => {
  const text = `${story.title} ${story.summary} ${story.category} ${story.tags.join(" ")}`.toLowerCase();
  if (topic === "中国 AI") return story.tags.includes("中文") || /中国|国产|北京|上海|深圳|杭州|deepseek|智谱|通义|文心|豆包/.test(text);
  if (topic === "融资") return /融资|投资|估值|收购|ipo|funding|investment|valuation|acquisition/.test(text);
  if (topic === "开源项目") return story.category === "开源项目" || /开源|open.?source|github/.test(text);
  return story.category === topic || text.includes(topic.toLowerCase());
};
const AnswerContent = ({ content }: { content: string }) => <div className="answer-content">
  {content.split("\n").map((line, index) => {
    const text = line.trim();
    if (!text) return null;
    if (/^(结论|核心发现|核心要点|综合判断|影响|接下来值得关注|不确定性|来源)$/.test(text)) return <h4 key={index}>{text}</h4>;
    if (/^(?:\d+[.、]|[-•])\s*/.test(text)) return <p className="answer-point" key={index}>{text.replace(/^(?:\d+[.、]|[-•])\s*/, "")}</p>;
    return <p key={index}>{text}</p>;
  })}
</div>;

export default function Home() {
  const [active, setActive] = useState("今日资讯");
  const [stories, setStories] = useState<Story[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [aiInsight, setAiInsight] = useState("");
  const [query, setQuery] = useState("");
  const [importance, setImportance] = useState("全部级别");
  const [timeRange, setTimeRange] = useState("全部时间");
  const [sort, setSort] = useState("综合排序");
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<Story | null>(null);
  const [articleDetail, setArticleDetail] = useState<ArticleDetail | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [detailTranslating, setDetailTranslating] = useState(false);
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [contentLanguage, setContentLanguage] = useState<"zh" | "en">("zh");
  const [pageTranslating, setPageTranslating] = useState(false);
  const [page, setPage] = useState(1);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("全部来源");
  const [sourcePage, setSourcePage] = useState(1);
  const [disabledSources, setDisabledSources] = useState<string[]>([]);
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>(topicOptions);
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [topicDraft, setTopicDraft] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [referenceNews, setReferenceNews] = useState(true);
  const [syncStage, setSyncStage] = useState("连接数据源");
  const [askStage, setAskStage] = useState("读取实时资讯");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadNews = useCallback(async (manual = false, disabledOverride?: string[]) => {
    if (manual) setRefreshing(true); else setLoading(true);
    setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const disabled = disabledOverride ?? JSON.parse(window.localStorage.getItem("ai-brief-disabled-sources") || "[]") as string[];
      const params = disabled.length ? `?disabled=${encodeURIComponent(disabled.join("|"))}` : "";
      const response = await fetch(`/api/news${params}`, { signal: controller.signal, cache: manual ? "no-store" : "default" });
      if (!response.ok) throw new Error("资讯接口暂时不可用");
      const data = await response.json() as { items: Story[]; sources: SourceStatus[]; updatedAt: string };
      setStories(data.items ?? []); setSources(data.sources ?? []); setUpdatedAt(data.updatedAt);
      window.localStorage.setItem("ai-brief-last-news", JSON.stringify(data));
    } catch {
      const cached = window.localStorage.getItem("ai-brief-last-news");
      if (cached) {
        const data = JSON.parse(cached) as { items: Story[]; sources: SourceStatus[]; updatedAt: string };
        setStories(data.items ?? []); setSources(data.sources ?? []); setUpdatedAt(data.updatedAt);
        setError("实时更新稍慢，已先展示上次成功获取的内容");
      } else setError("本次抓取超时，请点击重试；页面不会再无限等待。");
    } finally {
      window.clearTimeout(timer); setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("ai-brief-saved");
    if (stored) setSaved(JSON.parse(stored));
    const disabled = window.localStorage.getItem("ai-brief-disabled-sources");
    const disabledList = disabled ? JSON.parse(disabled) as string[] : [];
    setDisabledSources(disabledList);
    const cachedTranslations = window.localStorage.getItem("ai-brief-translations");
    if (cachedTranslations) setTranslations(JSON.parse(cachedTranslations));
    const topics = window.localStorage.getItem("ai-brief-topics");
    if (topics) setSubscribedTopics(JSON.parse(topics));
    const custom = window.localStorage.getItem("ai-brief-custom-topics");
    if (custom) setCustomTopics(JSON.parse(custom));
    setMotionEnabled(window.localStorage.getItem("ai-brief-motion") !== "off");
    setReferenceNews(window.localStorage.getItem("ai-brief-reference-news") !== "false");
    void loadNews(false, disabledList);
  }, [loadNews]);
  useEffect(() => { window.localStorage.setItem("ai-brief-saved", JSON.stringify(saved)); }, [saved]);
  useEffect(() => { window.localStorage.setItem("ai-brief-disabled-sources", JSON.stringify(disabledSources)); }, [disabledSources]);
  useEffect(() => { window.localStorage.setItem("ai-brief-translations", JSON.stringify(translations)); }, [translations]);
  useEffect(() => { window.localStorage.setItem("ai-brief-topics", JSON.stringify(subscribedTopics)); }, [subscribedTopics]);
  useEffect(() => { window.localStorage.setItem("ai-brief-custom-topics", JSON.stringify(customTopics)); }, [customTopics]);
  useEffect(() => { window.localStorage.setItem("ai-brief-motion", motionEnabled ? "on" : "off"); }, [motionEnabled]);
  useEffect(() => { window.localStorage.setItem("ai-brief-reference-news", String(referenceNews)); }, [referenceNews]);
  useEffect(() => {
    if (!loading && !refreshing) return;
    setSyncStage("连接数据源");
    const first = window.setTimeout(() => setSyncStage("聚合相同事件"), 900);
    const second = window.setTimeout(() => setSyncStage("生成今日摘要"), 2_100);
    return () => { window.clearTimeout(first); window.clearTimeout(second); };
  }, [loading, refreshing]);
  useEffect(() => {
    if (!asking) return;
    setAskStage("读取实时资讯");
    const first = window.setTimeout(() => setAskStage("跨来源综合判断"), 900);
    const second = window.setTimeout(() => setAskStage("组织答案与引用"), 2_100);
    return () => { window.clearTimeout(first); window.clearTimeout(second); };
  }, [asking]);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, asking, askStage]);

  const filtered = useMemo(() => {
    const result = stories.filter((story) => {
      const text = `${story.title}${story.summary}${story.source}${story.tags.join("")}`.toLowerCase();
      return (!query || text.includes(query.toLowerCase()))
        && (importance === "全部级别" || story.level === importance)
        && (timeRange === "全部时间" || Date.now() - new Date(story.publishedAt).getTime() <= (timeRange === "24小时" ? 86_400_000 : timeRange === "3天" ? 259_200_000 : 604_800_000))
        && !disabledSources.includes(story.source)
        && (active !== "我的收藏" || saved.includes(story.id));
    });
    const topicBoost = (story: Story) => active === "今日资讯" && subscribedTopics.some((topic) => matchesTopic(story, topic)) ? 1_000 : 0;
    return result.sort((a, b) => sort === "时间优先"
      ? new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      : sort === "多源提及优先" ? b.related - a.related
      : (topicBoost(b) + b.score + b.trustScore * .35 + b.related * 4) - (topicBoost(a) + a.score + a.trustScore * .35 + a.related * 4));
  }, [stories, query, importance, timeRange, disabledSources, active, saved, sort, subscribedTopics]);

  const topStories = filtered.slice(0, 5);
  const pageSize = 13;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [query, importance, timeRange, active, sort]);

  const toggleSaved = (id: string) => setSaved((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const toggleSource = (name: string) => {
    const next = disabledSources.includes(name) ? disabledSources.filter((item) => item !== name) : [...disabledSources, name];
    setDisabledSources(next);
    void loadNews(true, next);
  };
  const toggleTopic = (topic: string) => setSubscribedTopics((items) => items.includes(topic) ? items.filter((item) => item !== topic) : [...items, topic]);
  const saveTopic = () => {
    const nextName = topicDraft.trim().slice(0, 18);
    if (!nextName) return;
    if (editingTopic) {
      setCustomTopics((items) => [...new Set(items.map((item) => item === editingTopic ? nextName : item))]);
      setSubscribedTopics((items) => [...new Set(items.map((item) => item === editingTopic ? nextName : item))]);
    } else {
      setCustomTopics((items) => [...new Set([...items, nextName])]);
    }
    setEditingTopic(null); setTopicDraft("");
  };
  const displayed = (story: Story) => {
    const originalMatches = contentLanguage === "en" ? isEnglish(story) : !isEnglish(story);
    const translated = translations[story.id];
    return !originalMatches && translated?.target === contentLanguage ? translated : { title: story.title, summary: story.summary };
  };
  const openStory = (story: Story) => {
    setSelected(story); setArticleDetail(null); setArticleLoading(true);
    void fetch("/api/article", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: story.url, title: story.title, summary: story.summary, source: story.source }),
    })
      .then((response) => {
        if (!response.ok) throw new Error("原文读取失败");
        return response.json();
      }).then((data: {
        title?: string; description?: string; publishedAt?: string;
        imageUrl?: string; siteName?: string; author?: string; paragraphs?: string[];
        aiSummary?: string; keyPoints?: string[];
      }) => setArticleDetail({
        title: data.title || story.title,
        description: data.description || story.summary,
        imageUrl: data.imageUrl || story.imageUrl,
        publishedAt: data.publishedAt || story.publishedAt,
        siteName: data.siteName || story.source,
        author: data.author,
        aiSummary: data.aiSummary || data.description || story.summary,
        keyPoints: data.keyPoints || [],
        paragraphs: data.paragraphs || [],
      }))
      .catch(() => setArticleDetail(null)).finally(() => setArticleLoading(false));
  };
  const ask = async (prompt = question) => {
    const text = prompt.trim();
    if (!text || asking) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next); setQuestion(""); setAsking(true);
    try {
      const response = await fetch("/api/ask", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text, history: next, context: referenceNews ? stories.slice(0, 160) : [], referenceNews }),
      });
      const data = await response.json() as { answer?: string; citations?: ChatMessage["citations"]; followUps?: string[]; error?: string };
      setMessages((items) => [...items, { role: "assistant", content: data.answer ?? data.error ?? "暂时无法回答。", citations: data.citations, followUps: data.followUps }]);
    } catch { setMessages((items) => [...items, { role: "assistant", content: "问答服务暂时不可用，请稍后重试。" }]); }
    finally { setAsking(false); }
  };

  const categories = [...new Set(topStories.map((story) => story.category))];
  const insight = topStories.length
    ? `今天的 AI 资讯主要集中在${categories.slice(0, 2).join("与")}。${topStories[0].source}等一手来源持续释放新的产品、模型与行业信号。${topStories.some((item) => item.related >= 3) ? "部分关键事件已获得三个以上独立来源交叉印证，市场关注度正在上升。" : "部分新动态仍处于早期披露阶段，需要结合后续进展持续观察。"}整体趋势显示，AI 正从模型能力竞争进一步走向产品落地、开发工具和行业应用。`
    : "正在整理今天的核心趋势。系统会从最新资讯中提炼模型、产品与行业变化。关键事件将结合多来源信息交叉判断。请稍候片刻。";
  const dailyInsight = aiInsight || insight;
  const insightTranslationKey = `__insight:${dailyInsight}`;
  const visibleInsight = contentLanguage === "en" ? translations[insightTranslationKey]?.summary ?? dailyInsight : dailyInsight;
  const insightPoints = (visibleInsight.match(/[^。！？.!?]+[。！？.!?]?/g) ?? [visibleInsight]).map((item) => item.trim()).filter(Boolean).slice(0, 3);
  const filteredSources = useMemo(() => sources.filter((source) =>
    source.name.toLowerCase().includes(sourceQuery.toLowerCase())
    && (sourceFilter === "全部来源" || sourceCategory(source) === sourceFilter)
  ), [sourceFilter, sourceQuery, sources]);
  const sourcePageSize = 12;
  const sourceTotalPages = Math.max(1, Math.ceil(filteredSources.length / sourcePageSize));
  const pagedSources = filteredSources.slice((sourcePage - 1) * sourcePageSize, sourcePage * sourcePageSize);
  useEffect(() => setSourcePage(1), [sourceFilter, sourceQuery]);
  useEffect(() => {
    if (!stories.length) return;
    const controller = new AbortController();
    void fetch("/api/summary", {
      method: "POST", signal: controller.signal, headers: { "content-type": "application/json" },
      body: JSON.stringify({ stories: stories.slice(0, 36) }),
    }).then((response) => response.json()).then((data: { summary?: string }) => {
      if (data.summary) setAiInsight(data.summary);
    }).catch(() => undefined);
    return () => controller.abort();
  }, [stories]);
  useEffect(() => {
    if (loading || pageTranslating || !paged.length) return;
    const candidates = [...new Map([...paged, ...topStories].map((story) => [story.id, story])).values()]
      .filter((story) => contentLanguage === "zh" ? isEnglish(story) : !isEnglish(story))
      .filter((story) => translations[story.id]?.target !== contentLanguage);
    const needsInsight = contentLanguage === "en" && translations[insightTranslationKey]?.target !== "en";
    if (!candidates.length && !needsInsight) return;
    setPageTranslating(true);
    const items = [
      ...candidates.map((story) => ({ id: story.id, title: story.title, summary: story.summary })),
      ...(needsInsight ? [{ id: insightTranslationKey, title: "今日 AI 总结", summary: dailyInsight }] : []),
    ];
    void fetch("/api/translate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ items, target: contentLanguage }),
    }).then((response) => response.json()).then((data: { translations?: Array<{ id: string; title: string; summary: string }> }) => {
      if (!data.translations?.length) return;
      setTranslations((current) => {
        const next = { ...current };
        data.translations?.forEach((item) => { next[item.id] = { title: item.title, summary: item.summary, target: contentLanguage }; });
        return next;
      });
    }).finally(() => setPageTranslating(false));
  }, [active, contentLanguage, dailyInsight, insightTranslationKey, loading, page, pageTranslating, paged, topStories, translations]);

  useEffect(() => {
    if (!selected || !articleDetail || detailTranslating) return;
    const combined = `${articleDetail.title}${articleDetail.aiSummary}${articleDetail.description}${articleDetail.keyPoints.join("")}${articleDetail.paragraphs.join("")}`;
    const originalLanguage = /[\u4e00-\u9fff]/.test(combined) ? "zh" : "en";
    if (originalLanguage === contentLanguage) return;
    const prefix = `__detail:${selected.id}`;
    const items = [
      { id: `${prefix}:main`, title: articleDetail.title, summary: articleDetail.aiSummary },
      { id: `${prefix}:description`, title: "原文信息", summary: articleDetail.description },
      ...articleDetail.keyPoints.slice(0, 8).map((point, index) => ({ id: `${prefix}:point:${index}`, title: `重点 ${index + 1}`, summary: point })),
      ...articleDetail.paragraphs.slice(0, 6).map((paragraph, index) => ({ id: `${prefix}:paragraph:${index}`, title: `正文 ${index + 1}`, summary: paragraph })),
    ];
    const missing = items.filter((item) => translations[item.id]?.target !== contentLanguage);
    if (!missing.length) return;
    setDetailTranslating(true);
    void fetch("/api/translate", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ items: missing, target: contentLanguage }),
    }).then((response) => response.json()).then((data: { translations?: Array<{ id: string; title: string; summary: string }> }) => {
      if (!data.translations?.length) return;
      setTranslations((current) => {
        const next = { ...current };
        data.translations?.forEach((item) => { next[item.id] = { title: item.title, summary: item.summary, target: contentLanguage }; });
        return next;
      });
    }).finally(() => setDetailTranslating(false));
  }, [articleDetail, contentLanguage, detailTranslating, selected, translations]);

  const clearContentCache = () => {
    window.localStorage.removeItem("ai-brief-last-news");
    window.localStorage.removeItem("ai-brief-translations");
    setTranslations({});
    void loadNews(true);
  };

  return <main className={`app-shell ${sidebarCollapsed ? "nav-collapsed" : ""} ${motionEnabled ? "" : "reduce-motion"}`}>
    <aside className="sidebar">
      <button className="brand" onClick={() => setActive("今日资讯")} aria-label="返回首页">
        <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><path d="M9.5 20A10.5 10.5 0 0 1 20 9.5" /><path d="M30.5 20A10.5 10.5 0 0 1 20 30.5" /><path className="outer" d="M5.5 20A14.5 14.5 0 0 1 20 5.5" /><path className="outer" d="M34.5 20A14.5 14.5 0 0 1 20 34.5" /><circle cx="20" cy="20" r="3.2" /></svg></span>
        <span className="brand-copy"><b>AI Brief</b><small>SIGNAL INTELLIGENCE</small></span>
      </button>
      <p className="nav-label">探索</p>
      <nav>{nav.map((item) => <button key={item.label} className={active === item.label ? "active" : ""} onClick={() => setActive(item.label)}>
        <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
      </button>)}</nav>
      <button className={`settings-entry ${active === "设置" ? "active" : ""}`} onClick={() => setActive("设置")}><span className="nav-icon">⚙</span><span>设置</span></button>
      <button className="source-pulse" onClick={() => setActive("数据源网络")} aria-label="查看数据源状态">
        <span className="pulse-dot" />
        <div><b>{sources.filter((item) => item.ok).length}/{sources.length || "—"} 数据源在线</b><small>实时信号监测</small></div>
        <i>→</i>
      </button>
      <button className="collapse-nav" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "展开导航栏" : "收起导航栏"}>
        <span>{sidebarCollapsed ? "›" : "‹"}</span><b>{sidebarCollapsed ? "展开" : "收起导航"}</b>
      </button>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div className="mobile-brand"><span className="mini-logo">A</span> AI Brief</div>
        <section className="signal-banner">
          <div className="banner-orbit"><i /><i /><span>✦</span></div>
          <div><b>实时信号网络</b><small>DeepSeek 正在分析 {sources.length || 218} 个来源</small></div>
          <div className="banner-wave" aria-hidden="true">{Array.from({ length: 12 }).map((_, index) => <i key={index} />)}</div>
          <span className="banner-live"><i /> LIVE</span>
        </section>
        <label className="global-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索公司、模型、产品或议题…" /><kbd>⌘ K</kbd></label>
      </header>

      <div className="content page-stage" key={active}>
        {(active === "今日资讯" || active === "我的收藏") && <>
          <section className="page-intro reveal">
            <div className="intro-heading">{active === "今日资讯" && <time className="calendar-date"><span className="calendar-month"><b>{new Date().getMonth() + 1}</b><small>月</small></span><strong>{new Date().getDate()}<small>日</small></strong><span className="calendar-meta"><b>今日</b><small>{new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(new Date())}</small></span></time>}<div className="intro-copy"><span className="eyebrow">AI SIGNAL DESK</span>
              <h1>{active === "我的收藏" ? "我的收藏" : "今日资讯"}</h1>
              <p>{active === "我的收藏" ? "你保存的高价值内容，随时回来继续阅读。" : "从海量动态中提炼值得关注、值得相信、值得行动的事件。"}</p></div>
            </div>
            <div className="live-cluster"><div className={`live-status ${loading || refreshing ? "working" : ""}`}><span /><b>{loading || refreshing ? syncStage : "实时更新"}</b><small>{updatedAt ? `最近同步 ${formatDate(updatedAt)}` : "准备同步"}</small></div>
              {active === "今日资讯" && <button className={`refresh ${refreshing ? "spinning" : ""}`} onClick={() => void loadNews(true)} disabled={refreshing}><span>↻</span>{refreshing ? "同步中" : "刷新资讯"}</button>}
            </div>
          </section>

          {active === "今日资讯" && <section className="brief-hero reveal delay-1">
            <div className="brief-copy"><span className="hero-kicker">✦ AI 总结</span>{loading ? <h2>快速读取多个可靠信号源…</h2> : <ul className="insight-points">{insightPoints.map((point, index) => <li key={`${index}-${point}`}><i>{index + 1}</i><span>{point}</span></li>)}</ul>}</div>
            <div className="trend-stack">
              <span className="trend-title">今日重点</span>
              {topStories.slice(0, 3).map((story, i) => <button key={story.id} onClick={() => openStory(story)}><em>0{i + 1}</em><span>{cleanDisplayTitle(displayed(story).title, story.source)}</span><b>↗</b></button>)}
            </div>
          </section>}

          {active === "今日资讯" && <section className="control-deck reveal delay-2">
            <div className="topic-subscriptions">
              <div><span>关注主题</span><small>{subscribedTopics.length ? `已关注 ${subscribedTopics.length} 个主题，相关资讯将优先展示` : "选择你关心的方向，定制首页信息流"}</small></div>
              <div className="topic-chips">{customTopics.map((topic) => <span className="topic-chip" key={topic}>
                <button className={subscribedTopics.includes(topic) ? "active" : ""} onClick={() => toggleTopic(topic)}><i>{subscribedTopics.includes(topic) ? "✓" : "+"}</i>{topic}</button>
                <button className="edit-topic" onClick={() => { setEditingTopic(topic); setTopicDraft(topic); }} aria-label={`修改${topic}`}>✎</button>
              </span>)}<button className="add-topic" onClick={() => { setEditingTopic(""); setTopicDraft(""); }}>＋ 添加主题</button></div>
            </div>
            {editingTopic !== null && <div className="topic-editor"><input autoFocus value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveTopic(); }} placeholder="输入主题名称" maxLength={18} /><button onClick={saveTopic}>保存</button><button onClick={() => { setEditingTopic(null); setTopicDraft(""); }}>取消</button></div>}
            <div className="smart-filters">
              <div className="filter-group"><span>重要程度</span><div>{["全部级别","重要","关注","一般"].map((item) => <button key={item} className={importance === item ? "active" : ""} onClick={() => setImportance(item)}>{item === "全部级别" ? "全部" : item}</button>)}</div></div>
              <div className="filter-group"><span>发布时间</span><div>{["全部时间","24小时","3天","7天"].map((item) => <button key={item} className={timeRange === item ? "active" : ""} onClick={() => setTimeRange(item)}>{item === "全部时间" ? "全部" : item}</button>)}</div></div>
              <div className="filter-group sort-group"><span>排序方式</span><div>{[["综合排序","精选"],["时间优先","最新"],["多源提及优先","多源"]].map(([value, label]) => <button key={value} className={sort === value ? "active" : ""} onClick={() => setSort(value)} title={value}>{label}</button>)}</div></div>
            </div>
          </section>}

          {error && <div className="notice"><span>!</span><p>{error}</p><button onClick={() => void loadNews(true)}>立即重试</button></div>}
          <div className="result-meta"><span><b>{filtered.length}</b> 条资讯</span>
            <div className="result-actions"><div className={`page-language ${pageTranslating ? "loading" : ""}`} aria-label="页面语言">
              <button className={contentLanguage === "zh" ? "active" : ""} onClick={() => setContentLanguage("zh")}>中文</button>
              <button className={contentLanguage === "en" ? "active" : ""} onClick={() => setContentLanguage("en")}>EN</button>
              {pageTranslating && <span>翻译中…</span>}
            </div></div>
          </div>

          {loading ? <div className="skeleton-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}</div>
            : paged.length ? <section className="story-grid editorial">
              {paged.map((story, index) => {
                const translated = displayed(story);
                return <article className={`story-card ${index === 0 ? "lead" : ""}`} style={{ "--card-order": index } as React.CSSProperties} key={story.id} onClick={() => openStory(story)}>
                <div className="story-head"><span className="source-mark">{story.sourceMark}</span><div><b>{story.source}</b><small>{relative(story.publishedAt)}</small></div>
                  <button className={`save ${saved.includes(story.id) ? "saved" : ""}`} onClick={(e) => { e.stopPropagation(); toggleSaved(story.id); }} aria-label="收藏">{saved.includes(story.id) ? "♥" : "♡"}</button>
                </div>
                <div className="story-body"><div className="story-badges"><span>{story.category}</span><span className={`level ${story.level}`}>{story.level}</span></div>
                  <h2>{cleanDisplayTitle(translated.title, story.source)}</h2><p>{completeSummary(translated.summary)}</p>
                </div>
                <div className="story-foot"><span>{story.related >= 3 ? <><b className="multi-source">{story.related} 个来源提及</b> · {story.sourceMentions.slice(0, 3).join("、")}</> : null}</span><button>阅读洞察 <i>→</i></button></div>
              </article>;})}
            </section> : <div className="empty"><span>◇</span><h3>没有符合条件的内容</h3><p>调整筛选条件，或刷新获取最新资讯。</p></div>}

          {totalPages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← 上一页</button><span>{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>下一页 →</button></div>}
        </>}

        {active === "AI 问答" && <section className="ask-page reveal">
          <div className="ask-header"><span className="ask-orb">✦</span><span className="eyebrow">AI BRIEF RESEARCH ASSISTANT</span><h1>问清正在发生的 AI</h1><p>把新闻线索、对话背景与公开信息连接起来，给出清晰判断和可核查出处。</p></div>
          {!messages.length && <div className="suggestions">{["今天最重要的 AI 变化是什么？","最近有哪些新模型发布？","哪些新闻得到了多个来源印证？","总结中国 AI 行业近期趋势"].map((item) => <button key={item} onClick={() => void ask(item)}><span>↗</span>{item}</button>)}</div>}
          <div className="chat-stream">{messages.map((message, index) => <div className={`message ${message.role}`} key={index}>
            <span className="avatar">{message.role === "user" ? "你" : "✦"}</span><div>{message.role === "assistant" ? <AnswerContent content={message.content} /> : <p>{message.content}</p>}
              {message.citations?.length ? <div className="citations">{message.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer"><b>{citation.source}</b><span>{citation.title}</span>↗</a>)}</div> : null}
              {message.role === "assistant" && message.followUps?.length ? <div className="follow-ups"><span>继续研究</span>{message.followUps.map((item) => <button key={item} onClick={() => void ask(item)} disabled={asking}><i>↗</i>{item}</button>)}</div> : null}
            </div></div>)}{asking && <div className="message assistant generating"><span className="avatar">✦</span><div className="thinking"><span>{askStage}</span><div><i /><i /><i /></div><b><em /></b></div></div>}<div ref={chatEndRef} /></div>
          <div className="ask-composer"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder="问任何关于 AI 行业、产品、模型或趋势的问题…" /><div><button className={`composer-source-switch ${referenceNews ? "on" : ""}`} onClick={() => setReferenceNews((value) => !value)} role="switch" aria-checked={referenceNews}><i /><span>参考 AI 资讯</span></button><span>Enter 发送</span><button onClick={() => void ask()} disabled={!question.trim() || asking}>发送 <b>↑</b></button></div></div>
        </section>}

        {active === "数据源网络" && <section className="sources-page reveal">
          <div className="page-intro"><div><span className="eyebrow">SOURCE INTELLIGENCE</span><h1>数据源网络</h1><p>连接全球实验室、学术机构与科技媒体，持续汇集可靠的一手信号。</p></div></div>
          <label className="source-search">⌕<input value={sourceQuery} onChange={(e) => setSourceQuery(e.target.value)} placeholder="搜索数据源…" /></label>
          <div className="source-summary"><div><b>{sources.length}</b><span>数据源总数</span></div><div><b>{sources.filter((source) => !disabledSources.includes(source.name)).length}</b><span>已启用数据源</span></div><div><b>{sources.filter((s) => s.ok).length}</b><span>在线数据源</span></div></div>
          <div className="source-category-tabs">{sourceCategories.map((item) => {
            const count = item === "全部来源" ? sources.length : sources.filter((source) => sourceCategory(source) === item).length;
            return <button key={item} className={sourceFilter === item ? "active" : ""} onClick={() => setSourceFilter(item)}>{item}<span>{count}</span></button>;
          })}</div>
          <div className="source-result-meta"><span><b>{filteredSources.length}</b> 个来源</span><span>第 {sourcePage} / {sourceTotalPages} 页</span></div>
          <div className="source-tag-grid" key={`${sourceFilter}-${sourceQuery}-${sourcePage}`}>{pagedSources.map((source) => {
            const enabled = !disabledSources.includes(source.name);
            return <article className={`source-tag ${enabled ? "" : "disabled"}`} key={source.name}>
              <div className="source-tag-head"><span className="source-mark">{source.mark}</span><div><b>{source.name}</b><small>{sourceCategory(source)}</small></div>
                <button className={`source-toggle ${enabled ? "on" : ""}`} onClick={() => toggleSource(source.name)} role="switch" aria-checked={enabled} aria-label={`${enabled ? "停用" : "启用"} ${source.name}`}><i /></button>
              </div>
              <div className="source-tags"><span>{source.chinese ? "中文内容" : "国际来源"}</span><span>{source.type === "atom" ? "Atom" : "RSS / 聚合"}</span><span>{enabled ? "已启用" : "已停用"}</span></div>
              <div className="source-tag-meta"><span className={`health ${source.ok ? "ok" : ""}`}>{source.ok ? "在线" : "暂时不可用"}</span><span>{source.itemCount} 条内容</span><a href={source.homepage} target="_blank" rel="noreferrer">访问来源 ↗</a></div>
            </article>;
          })}</div>
          {sourceTotalPages > 1 && <div className="pagination source-pagination"><button disabled={sourcePage === 1} onClick={() => setSourcePage((value) => value - 1)}>← 上一页</button><div>{Array.from({ length: sourceTotalPages }, (_, index) => index + 1).slice(Math.max(0, sourcePage - 3), Math.min(sourceTotalPages, sourcePage + 2)).map((item) => <button key={item} className={sourcePage === item ? "active" : ""} onClick={() => setSourcePage(item)}>{item}</button>)}</div><button disabled={sourcePage === sourceTotalPages} onClick={() => setSourcePage((value) => value + 1)}>下一页 →</button></div>}
        </section>}

        {active === "设置" && <section className="settings-page reveal">
          <div className="page-intro"><div><span className="eyebrow">WORKSPACE SETTINGS</span><h1>设置</h1><p>管理阅读偏好、动效、模型状态与管理员信息。</p></div></div>
          <div className="settings-grid">
            <section className="settings-card admin-card"><span className="settings-label">管理员</span><div className="admin-profile"><i>周</i><div><h3>周 玉川</h3><p>AI Brief 管理员</p></div><b>OWNER</b></div><div className="admin-meta"><span>工作区<b>AI Brief</b></span><span>数据网络<b>{sources.length || 218} 个来源</b></span><span>在线状态<b>{sources.filter((item) => item.ok).length} 个在线</b></span></div></section>
            <section className="settings-card model-card"><span className="settings-label">AI 模型</span><div className="model-status"><i>◆</i><div><h3>DeepSeek</h3><p>总结、翻译、详情摘要与研究问答</p></div><span><i /> 已连接</span></div><small>模型密钥由 Vercel Production 环境安全管理，不写入浏览器或 GitHub。</small></section>
            <section className="settings-card preference-card"><span className="settings-label">阅读偏好</span><div className="setting-row"><div><b>默认内容语言</b><small>切换首页和收藏内容的展示语言</small></div><div className="setting-options"><button className={contentLanguage === "zh" ? "active" : ""} onClick={() => setContentLanguage("zh")}>中文</button><button className={contentLanguage === "en" ? "active" : ""} onClick={() => setContentLanguage("en")}>English</button></div></div><div className="setting-row"><div><b>界面动效</b><small>控制页面切换、信号波形与卡片反馈</small></div><button className={`settings-toggle ${motionEnabled ? "on" : ""}`} onClick={() => setMotionEnabled((value) => !value)} role="switch" aria-checked={motionEnabled}><i /></button></div></section>
            <section className="settings-card cache-card"><span className="settings-label">内容缓存</span><h3>刷新本地内容</h3><p>清理翻译和上次资讯缓存，并立即重新获取最新内容。收藏与主题订阅不会受到影响。</p><button onClick={clearContentCache}>清理并重新同步 ↻</button></section>
          </div>
        </section>}
      </div>
    </section>

    {selected && <><button className="backdrop" onClick={() => setSelected(null)} aria-label="关闭详情" /><aside className="drawer" key={selected.id}>
      <div className="drawer-head"><span>AI Brief · 内容洞察</span><button onClick={() => setSelected(null)}>×</button></div>
      <div className="drawer-content">
        <div className="drawer-source"><span className="source-mark">{selected.sourceMark}</span><div><b>{selected.source}</b><small>{formatDate(selected.publishedAt)}</small></div></div>
        <div className="story-badges"><span>{selected.category}</span><span className={`level ${selected.level}`}>{selected.level}</span></div>
        {(articleDetail?.imageUrl || selected.imageUrl) && <img className="article-image" src={articleDetail?.imageUrl || selected.imageUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
        <h2>{cleanDisplayTitle(translations[`__detail:${selected.id}:main`]?.target === contentLanguage ? translations[`__detail:${selected.id}:main`].title : displayed(selected).title || articleDetail?.title || selected.title, selected.source)}</h2>
        <div className="original-meta"><span>{articleDetail?.siteName || selected.source}</span>{articleDetail?.author && <span>作者：{articleDetail.author}</span>}<span>{formatDate(articleDetail?.publishedAt || selected.publishedAt)}</span></div>
        <section className="drawer-section ai-summary"><span>AI 总结摘要</span>
          {articleLoading ? <div className="summary-loading">正在读取原文并生成摘要…</div> : detailTranslating ? <div className="summary-loading">正在翻译完整详情…</div> : <p>{translations[`__detail:${selected.id}:main`]?.target === contentLanguage ? translations[`__detail:${selected.id}:main`].summary : articleDetail?.aiSummary || displayed(selected).summary || selected.summary}</p>}
          {!!articleDetail?.keyPoints?.length && <ul>{articleDetail.keyPoints.map((point, index) => {
            const translatedPoint = translations[`__detail:${selected.id}:point:${index}`];
            const sentence = oneSentence(translatedPoint?.target === contentLanguage ? translatedPoint.summary : point);
            return sentence ? <li key={point}><strong>{sentence}</strong></li> : null;
          })}</ul>}
        </section>
        {selected.related >= 3 && <section className="evidence-box"><span>多源验证</span><h3>{selected.related} 个独立来源提及此事件</h3><p>{selected.sourceMentions.join("、")}</p></section>}
        <section className="drawer-section original-content"><span>原文信息</span>
          <p>{translations[`__detail:${selected.id}:description`]?.target === contentLanguage ? translations[`__detail:${selected.id}:description`].summary : articleDetail?.description ?? displayed(selected).summary}</p>
          {articleDetail?.paragraphs?.slice(0, 6).map((paragraph, index) => {
            const translatedParagraph = translations[`__detail:${selected.id}:paragraph:${index}`];
            return <p key={`${index}-${paragraph.slice(0, 20)}`}>{translatedParagraph?.target === contentLanguage ? translatedParagraph.summary : paragraph}</p>;
          })}
        </section>
        <div className="drawer-actions"><button onClick={() => toggleSaved(selected.id)}>{saved.includes(selected.id) ? "♥ 已收藏" : "♡ 收藏"}</button><a href={selected.url} target="_blank" rel="noreferrer">阅读原文 ↗</a></div>
      </div>
    </aside></>}
  </main>;
}
