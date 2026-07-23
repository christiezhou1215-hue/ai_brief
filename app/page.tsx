"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
type ChatMessage = { role: "user" | "assistant"; content: string; citations?: Array<{ title: string; source: string; url: string }> };
type Translation = { title: string; summary: string; target: "zh" | "en" };
type ArticleDetail = { title: string; description: string; imageUrl?: string; siteName?: string; author?: string; publishedAt?: string; aiSummary: string; keyPoints: string[] };

const nav = [
  { icon: "✦", label: "今日资讯" },
  { icon: "✧", label: "AI 问答" },
  { icon: "♡", label: "我的收藏" },
  { icon: "◉", label: "数据源" },
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
  if (topic === "中国 AI") return story.tags.includes("中文") || /中国|国产|北京|上海|深圳|杭州|deepseek|智谱|通义|千问|文心|豆包/.test(text);
  if (topic === "融资") return /融资|投资|估值|收购|ipo|funding|investment|valuation|acquisition/.test(text);
  if (topic === "开源项目") return story.category === "开源项目" || /开源|open.?source|github/.test(text);
  return story.category === topic;
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
  const [category, setCategory] = useState("全部分类");
  const [importance, setImportance] = useState("全部级别");
  const [sort, setSort] = useState("综合排序");
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<Story | null>(null);
  const [articleDetail, setArticleDetail] = useState<ArticleDetail | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [contentLanguage, setContentLanguage] = useState<"zh" | "en">("zh");
  const [pageTranslating, setPageTranslating] = useState(false);
  const [page, setPage] = useState(1);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("全部来源");
  const [disabledSources, setDisabledSources] = useState<string[]>([]);
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
    void loadNews(false, disabledList);
  }, [loadNews]);
  useEffect(() => { window.localStorage.setItem("ai-brief-saved", JSON.stringify(saved)); }, [saved]);
  useEffect(() => { window.localStorage.setItem("ai-brief-disabled-sources", JSON.stringify(disabledSources)); }, [disabledSources]);
  useEffect(() => { window.localStorage.setItem("ai-brief-translations", JSON.stringify(translations)); }, [translations]);
  useEffect(() => { window.localStorage.setItem("ai-brief-topics", JSON.stringify(subscribedTopics)); }, [subscribedTopics]);

  const filtered = useMemo(() => {
    const result = stories.filter((story) => {
      const text = `${story.title}${story.summary}${story.source}${story.tags.join("")}`.toLowerCase();
      return (!query || text.includes(query.toLowerCase()))
        && (category === "全部分类" || story.category === category)
        && (importance === "全部级别" || story.level === importance)
        && !disabledSources.includes(story.source)
        && (active !== "我的收藏" || saved.includes(story.id));
    });
    const topicBoost = (story: Story) => active === "今日资讯" && subscribedTopics.some((topic) => matchesTopic(story, topic)) ? 1_000 : 0;
    return result.sort((a, b) => sort === "时间优先"
      ? new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      : sort === "多源提及优先" ? b.related - a.related
      : (topicBoost(b) + b.score + b.trustScore * .35 + b.related * 4) - (topicBoost(a) + a.score + a.trustScore * .35 + a.related * 4));
  }, [stories, query, category, importance, disabledSources, active, saved, sort, subscribedTopics]);

  const topStories = filtered.slice(0, 5);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [query, category, importance, active, sort]);

  const toggleSaved = (id: string) => setSaved((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const toggleSource = (name: string) => {
    const next = disabledSources.includes(name) ? disabledSources.filter((item) => item !== name) : [...disabledSources, name];
    setDisabledSources(next);
    void loadNews(true, next);
  };
  const toggleTopic = (topic: string) => setSubscribedTopics((items) => items.includes(topic) ? items.filter((item) => item !== topic) : [...items, topic]);
  const displayed = (story: Story) => {
    const originalMatches = contentLanguage === "en" ? isEnglish(story) : !isEnglish(story);
    const translated = translations[story.id];
    return !originalMatches && translated?.target === contentLanguage ? translated : { title: story.title, summary: story.summary };
  };
  const openStory = (story: Story) => {
    setSelected(story); setArticleDetail(null); setArticleLoading(true);
    void fetch(`/api/article?url=${encodeURIComponent(story.url)}`)
      .then((response) => {
        if (!response.ok) throw new Error("原文读取失败");
        return response.json();
      }).then((data: {
        title?: string; description?: string; publishedAt?: string;
        images?: Array<{ url: string }>; aiSummary?: { overview?: string; keyPoints?: string[] };
      }) => setArticleDetail({
        title: data.title || story.title,
        description: data.description || story.summary,
        imageUrl: data.images?.[0]?.url || story.imageUrl,
        publishedAt: data.publishedAt || story.publishedAt,
        siteName: story.source,
        aiSummary: data.aiSummary?.overview || data.description || story.summary,
        keyPoints: data.aiSummary?.keyPoints || [],
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
        body: JSON.stringify({ question: text, history: next, context: stories.slice(0, 60) }),
      });
      const data = await response.json() as { answer?: string; citations?: ChatMessage["citations"]; error?: string };
      setMessages((items) => [...items, { role: "assistant", content: data.answer ?? data.error ?? "暂时无法回答。", citations: data.citations }]);
    } catch { setMessages((items) => [...items, { role: "assistant", content: "问答服务暂时不可用，请稍后重试。" }]); }
    finally { setAsking(false); }
  };

  const categories = [...new Set(topStories.map((story) => story.category))];
  const insight = topStories.length
    ? `今天的 AI 资讯主要集中在${categories.slice(0, 2).join("与")}。${topStories[0].source}等一手来源持续释放新的产品、模型与行业信号。${topStories.some((item) => item.related >= 3) ? "部分关键事件已获得三个以上独立来源交叉印证，市场关注度正在上升。" : "部分新动态仍处于早期披露阶段，需要结合后续进展持续观察。"}整体趋势显示，AI 正从模型能力竞争进一步走向产品落地、开发工具和行业应用。`
    : "正在整理今天的核心趋势。系统会从最新资讯中提炼模型、产品与行业变化。关键事件将结合多来源信息交叉判断。请稍候片刻。";
  const dailyInsight = aiInsight || insight;
  const insightTranslationKey = `__insight:${dailyInsight}`;
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

  return <main className={`app-shell ${sidebarCollapsed ? "nav-collapsed" : ""}`}>
    <aside className="sidebar">
      <button className="brand" onClick={() => setActive("今日资讯")} aria-label="返回首页">
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span>AI Brief</span>
      </button>
      <p className="nav-label">探索</p>
      <nav>{nav.map((item) => <button key={item.label} className={active === item.label ? "active" : ""} onClick={() => setActive(item.label)}>
        <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
      </button>)}</nav>
      <button className="collapse-nav" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? "展开导航栏" : "收起导航栏"}>
        <span>{sidebarCollapsed ? "›" : "‹"}</span><b>{sidebarCollapsed ? "展开" : "收起导航"}</b>
      </button>
      <div className="source-pulse">
        <span className="pulse-dot" />
        <div><b>{sources.filter((item) => item.ok).length}/{sources.length || "—"} 数据源在线</b><small>实时信号监测</small></div>
      </div>
      <div className="profile"><span>周</span><div><b>周 玉川</b><small>AI Brief 管理员</small></div><button>•••</button></div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div className="mobile-brand"><span className="mini-logo">A</span> AI Brief</div>
        <label className="global-search"><span>⌕</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索公司、模型、产品或议题…" /><kbd>⌘ K</kbd></label>
        <button className={`refresh ${refreshing ? "spinning" : ""}`} onClick={() => void loadNews(true)} disabled={refreshing}>
          <span>↻</span>{refreshing ? "同步中" : "刷新资讯"}
        </button>
      </header>

      <div className="content">
        {(active === "今日资讯" || active === "我的收藏") && <>
          <section className="page-intro reveal">
            <div><span className="eyebrow">AI SIGNAL DESK · {new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date())}</span>
              <h1>{active === "我的收藏" ? "我的收藏" : "今日资讯"}</h1>
              <p>{active === "我的收藏" ? "你保存的高价值内容，随时回来继续阅读。" : "从海量动态中提炼值得关注、值得相信、值得行动的事件。"}</p>
            </div>
            <div className="live-status"><span /><b>{loading ? "正在建立实时连接" : "实时更新"}</b><small>{updatedAt ? `最近同步 ${formatDate(updatedAt)}` : "准备同步"}</small></div>
          </section>

          {active === "今日资讯" && <section className="brief-hero reveal delay-1">
            <div className="brief-copy"><span className="hero-kicker">✦ AI 总结</span><h2>{loading ? "快速读取多个可靠信号源…" : contentLanguage === "en" ? translations[insightTranslationKey]?.summary ?? dailyInsight : dailyInsight}</h2></div>
            <div className="trend-stack">
              <span className="trend-title">今日核心趋势</span>
              {topStories.slice(0, 3).map((story, i) => <button key={story.id} onClick={() => openStory(story)}><em>0{i + 1}</em><span>{displayed(story).title}</span><b>↗</b></button>)}
            </div>
          </section>}

          <section className="control-deck reveal delay-2">
            <div className="topic-subscriptions">
              <div><span>关注主题</span><small>{subscribedTopics.length ? `已关注 ${subscribedTopics.length} 个主题，相关资讯将优先展示` : "选择你关心的方向，定制首页信息流"}</small></div>
              <div className="topic-chips">{topicOptions.map((topic) => <button key={topic} className={subscribedTopics.includes(topic) ? "active" : ""} onClick={() => toggleTopic(topic)}>
                <i>{subscribedTopics.includes(topic) ? "✓" : "+"}</i>{topic}
              </button>)}</div>
            </div>
            <div className="filters">
              <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="分类"><option>全部分类</option>{["模型发布","AI Agent","AI 编程","多模态","开源项目","学术研究","行业动态"].map((x) => <option key={x}>{x}</option>)}</select>
              <select value={importance} onChange={(e) => setImportance(e.target.value)} aria-label="重要程度"><option>全部级别</option><option>重要</option><option>关注</option><option>一般</option></select>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="排序"><option>综合排序</option><option>时间优先</option><option>多源提及优先</option></select>
            </div>
          </section>

          {error && <div className="notice"><span>!</span><p>{error}</p><button onClick={() => void loadNews(true)}>立即重试</button></div>}
          <div className="result-meta"><span><b>{filtered.length}</b> 条资讯</span>
            <div className={`page-language ${pageTranslating ? "loading" : ""}`} aria-label="页面语言">
              <button className={contentLanguage === "zh" ? "active" : ""} onClick={() => setContentLanguage("zh")}>中文</button>
              <button className={contentLanguage === "en" ? "active" : ""} onClick={() => setContentLanguage("en")}>EN</button>
              {pageTranslating && <span>翻译中…</span>}
            </div>
          </div>

          {loading ? <div className="skeleton-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}</div>
            : paged.length ? <section className="story-grid editorial">
              {paged.map((story, index) => {
                const translated = displayed(story);
                return <article className={`story-card ${index === 0 ? "lead" : ""}`} key={story.id} onClick={() => openStory(story)}>
                <div className="story-head"><span className="source-mark">{story.sourceMark}</span><div><b>{story.source}</b><small>{relative(story.publishedAt)}</small></div>
                  <button className={`save ${saved.includes(story.id) ? "saved" : ""}`} onClick={(e) => { e.stopPropagation(); toggleSaved(story.id); }} aria-label="收藏">{saved.includes(story.id) ? "♥" : "♡"}</button>
                </div>
                <div className="story-body"><div className="story-badges"><span>{story.category}</span><span className={`level ${story.level}`}>{story.level}</span></div>
                  <h2>{translated.title}</h2><p>{translated.summary}</p>
                </div>
                <div className="story-foot"><span>{story.related >= 3 ? <><b className="multi-source">{story.related} 个来源提及</b> · {story.sourceMentions.slice(0, 3).join("、")}</> : null}</span><button>阅读洞察 <i>→</i></button></div>
              </article>;})}
            </section> : <div className="empty"><span>◇</span><h3>没有符合条件的内容</h3><p>调整筛选条件，或刷新获取最新资讯。</p></div>}

          {totalPages > 1 && <div className="pagination"><button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← 上一页</button><span>{page} / {totalPages}</span><button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>下一页 →</button></div>}
        </>}

        {active === "AI 问答" && <section className="ask-page reveal">
          <div className="ask-header"><span className="ask-orb">✦</span><span className="eyebrow">AI BRIEF RESEARCH ASSISTANT</span><h1>从资讯中，找到答案。</h1><p>基于当前抓取的新闻、历史上下文与多来源信号进行回答，并附上可核查的出处。</p></div>
          {!messages.length && <div className="suggestions">{["今天最重要的 AI 变化是什么？","最近有哪些新模型发布？","哪些新闻得到了多个来源印证？","总结中国 AI 行业近期趋势"].map((item) => <button key={item} onClick={() => void ask(item)}><span>↗</span>{item}</button>)}</div>}
          <div className="chat-stream">{messages.map((message, index) => <div className={`message ${message.role}`} key={index}>
            <span className="avatar">{message.role === "user" ? "你" : "✦"}</span><div>{message.role === "assistant" ? <AnswerContent content={message.content} /> : <p>{message.content}</p>}
              {message.citations?.length ? <div className="citations">{message.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer"><b>{citation.source}</b><span>{citation.title}</span>↗</a>)}</div> : null}
            </div></div>)}{asking && <div className="message assistant"><span className="avatar">✦</span><div className="thinking"><i /><i /><i /></div></div>}</div>
          <div className="ask-composer"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder="问任何关于 AI 行业、产品、模型或趋势的问题…" /><div><span>回答将优先引用当前资讯 · Enter 发送</span><button onClick={() => void ask()} disabled={!question.trim() || asking}>发送 <b>↑</b></button></div></div>
        </section>}

        {active === "数据源" && <section className="sources-page reveal">
          <div className="page-intro"><div><span className="eyebrow">SOURCE INTELLIGENCE</span><h1>数据源网络</h1><p>中文资讯优先，同时保留全球实验室、学术与科技媒体的一手信号。</p></div></div>
          <label className="source-search">⌕<input value={sourceQuery} onChange={(e) => setSourceQuery(e.target.value)} placeholder="搜索数据源…" /></label>
          <div className="source-summary"><div><b>{sources.length}</b><span>数据源总数</span></div><div><b>{sources.filter((source) => !disabledSources.includes(source.name)).length}</b><span>已启用数据源</span></div><div><b>{sources.filter((s) => s.ok).length}</b><span>在线数据源</span></div></div>
          <div className="source-category-tabs">{sourceCategories.map((item) => {
            const count = item === "全部来源" ? sources.length : sources.filter((source) => sourceCategory(source) === item).length;
            return <button key={item} className={sourceFilter === item ? "active" : ""} onClick={() => setSourceFilter(item)}>{item}<span>{count}</span></button>;
          })}</div>
          <div className="source-tag-grid">{sources.filter((source) =>
            source.name.toLowerCase().includes(sourceQuery.toLowerCase())
            && (sourceFilter === "全部来源" || sourceCategory(source) === sourceFilter)
          ).map((source) => {
            const enabled = !disabledSources.includes(source.name);
            return <article className={`source-tag ${enabled ? "" : "disabled"}`} key={source.name}>
              <div className="source-tag-head"><span className="source-mark">{source.mark}</span><div><b>{source.name}</b><small>{sourceCategory(source)}</small></div>
                <button className={`source-toggle ${enabled ? "on" : ""}`} onClick={() => toggleSource(source.name)} role="switch" aria-checked={enabled} aria-label={`${enabled ? "停用" : "启用"} ${source.name}`}><i /></button>
              </div>
              <div className="source-tag-meta"><span className={`health ${source.ok ? "ok" : ""}`}>{source.ok ? "在线" : "暂时不可用"}</span><span>{source.itemCount} 条内容</span><a href={source.homepage} target="_blank" rel="noreferrer">访问来源 ↗</a></div>
            </article>;
          })}</div>
        </section>}
      </div>
    </section>

    {selected && <><button className="backdrop" onClick={() => setSelected(null)} aria-label="关闭详情" /><aside className="drawer">
      <div className="drawer-head"><span>AI Brief · 内容洞察</span><button onClick={() => setSelected(null)}>×</button></div>
      <div className="drawer-content">
        <div className="drawer-source"><span className="source-mark">{selected.sourceMark}</span><div><b>{selected.source}</b><small>{formatDate(selected.publishedAt)}</small></div></div>
        <div className="story-badges"><span>{selected.category}</span><span className={`level ${selected.level}`}>{selected.level}</span></div>
        {(articleDetail?.imageUrl || selected.imageUrl) && <img className="article-image" src={articleDetail?.imageUrl || selected.imageUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} />}
        <h2>{displayed(selected).title || articleDetail?.title || selected.title}</h2>
        <div className="original-meta"><span>{articleDetail?.siteName || selected.source}</span>{articleDetail?.author && <span>作者：{articleDetail.author}</span>}<span>{formatDate(articleDetail?.publishedAt || selected.publishedAt)}</span></div>
        <section className="drawer-section ai-summary"><span>AI 总结摘要</span>
          {articleLoading ? <div className="summary-loading">正在读取原文并生成摘要…</div> : <p>{displayed(selected).summary || articleDetail?.aiSummary || selected.summary}</p>}
          {!!articleDetail?.keyPoints?.length && <ul>{articleDetail.keyPoints.map((point) => {
            const sentence = oneSentence(point);
            return sentence ? <li key={point}><strong>{sentence}</strong></li> : null;
          })}</ul>}
        </section>
        {selected.related >= 3 && <section className="evidence-box"><span>多源验证</span><h3>{selected.related} 个独立来源提及此事件</h3><p>{selected.sourceMentions.join("、")}</p></section>}
        <section className="drawer-section"><span>原文信息</span><p>{articleDetail?.description ?? selected.summary}</p></section>
        <div className="drawer-actions"><button onClick={() => toggleSaved(selected.id)}>{saved.includes(selected.id) ? "♥ 已收藏" : "♡ 收藏"}</button><a href={selected.url} target="_blank" rel="noreferrer">阅读原文 ↗</a></div>
      </div>
    </aside></>}
  </main>;
}
