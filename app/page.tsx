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
  { icon: "✧", label: "AI 问答", badge: "NEW" },
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

export default function Home() {
  const [active, setActive] = useState("今日资讯");
  const [stories, setStories] = useState<Story[]>([]);
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部分类");
  const [importance, setImportance] = useState("全部级别");
  const [sort, setSort] = useState("综合排序");
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<Story | null>(null);
  const [articleDetail, setArticleDetail] = useState<ArticleDetail | null>(null);
  const [articleLoading, setArticleLoading] = useState(false);
  const [translations, setTranslations] = useState<Record<string, Translation>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sourceQuery, setSourceQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const loadNews = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true); else setLoading(true);
    setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch("/api/news", { signal: controller.signal, cache: manual ? "no-store" : "default" });
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
    void loadNews();
  }, [loadNews]);
  useEffect(() => { window.localStorage.setItem("ai-brief-saved", JSON.stringify(saved)); }, [saved]);

  const filtered = useMemo(() => {
    const result = stories.filter((story) => {
      const text = `${story.title}${story.summary}${story.source}${story.tags.join("")}`.toLowerCase();
      return (!query || text.includes(query.toLowerCase()))
        && (category === "全部分类" || story.category === category)
        && (importance === "全部级别" || story.level === importance)
        && (active !== "我的收藏" || saved.includes(story.id));
    });
    return result.sort((a, b) => sort === "时间优先"
      ? new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      : sort === "多源提及优先" ? b.related - a.related
      : (b.score + b.trustScore * .35 + b.related * 4) - (a.score + a.trustScore * .35 + a.related * 4));
  }, [stories, query, category, importance, active, saved, sort]);

  const topStories = filtered.slice(0, 5);
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [query, category, importance, active, sort]);

  const toggleSaved = (id: string) => setSaved((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  const translateStory = async (story: Story) => {
    if (translations[story.id]) {
      setTranslations((items) => {
        const next = { ...items };
        delete next[story.id];
        return next;
      });
      return;
    }
    setTranslating(story.id);
    try {
      const target = isEnglish(story) ? "zh" : "en";
      const response = await fetch("/api/translate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: story.title, summary: story.summary, target }),
      });
      const data = await response.json() as Translation;
      if (data.title && data.summary) setTranslations((items) => ({ ...items, [story.id]: { ...data, target } }));
    } finally { setTranslating(null); }
  };
  const openStory = (story: Story) => {
    setSelected(story); setArticleDetail(null); setArticleLoading(true);
    void fetch("/api/article", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: story.url, title: story.title, summary: story.summary }),
    }).then((response) => response.json()).then((data: ArticleDetail) => setArticleDetail(data))
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

  return <main className={`app-shell ${sidebarCollapsed ? "nav-collapsed" : ""}`}>
    <aside className="sidebar">
      <button className="brand" onClick={() => setActive("今日资讯")} aria-label="返回首页">
        <span className="brand-mark"><b>A</b><i /><i /></span>
        <span>AI Brief<small>信号，不是噪音</small></span>
      </button>
      <p className="nav-label">探索</p>
      <nav>{nav.map((item) => <button key={item.label} className={active === item.label ? "active" : ""} onClick={() => setActive(item.label)}>
        <span className="nav-icon">{item.icon}</span><span>{item.label}</span>{item.badge && <em>{item.badge}</em>}
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
              <p>{active === "我的收藏" ? "你保存的高价值内容，随时回来继续阅读。" : "从海量动态中提炼值得关注、值得相信、值得行动的信号。"}</p>
            </div>
            <div className="live-status"><span /><b>{loading ? "正在建立实时连接" : "实时更新"}</b><small>{updatedAt ? `最近同步 ${formatDate(updatedAt)}` : "准备同步"}</small></div>
          </section>

          {active === "今日资讯" && <section className="brief-hero reveal delay-1">
            <div className="brief-copy"><span className="hero-kicker">✦ 今日核心趋势</span><h2>{loading ? "快速读取多个可靠信号源…" : insight}</h2></div>
            <div className="trend-stack">
              <span className="trend-title">今日核心信号</span>
              {topStories.slice(0, 3).map((story, i) => <button key={story.id} onClick={() => openStory(story)}><em>0{i + 1}</em><span>{story.title}</span><b>↗</b></button>)}
            </div>
          </section>}

          <section className="control-deck reveal delay-2">
            <div className="filters">
              <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="分类"><option>全部分类</option>{["模型发布","AI Agent","AI 编程","多模态","开源项目","学术研究","行业动态"].map((x) => <option key={x}>{x}</option>)}</select>
              <select value={importance} onChange={(e) => setImportance(e.target.value)} aria-label="重要程度"><option>全部级别</option><option>重要</option><option>关注</option><option>一般</option></select>
              <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="排序"><option>综合排序</option><option>时间优先</option><option>多源提及优先</option></select>
            </div>
          </section>

          {error && <div className="notice"><span>!</span><p>{error}</p><button onClick={() => void loadNews(true)}>立即重试</button></div>}
          <div className="result-meta"><span><b>{filtered.length}</b> 条资讯</span></div>

          {loading ? <div className="skeleton-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}</div>
            : paged.length ? <section className="story-grid editorial">
              {paged.map((story, index) => {
                const translated = translations[story.id];
                return <article className={`story-card ${index === 0 ? "lead" : ""}`} key={story.id} onClick={() => openStory(story)}>
                <div className="story-head"><span className="source-mark">{story.sourceMark}</span><div><b>{story.source}</b><small>{relative(story.publishedAt)}</small></div>
                  <span className={`trust ${story.trustLabel}`}>● {story.trustLabel} {story.trustScore}</span>
                  <button className="translate-btn" onClick={(e) => { e.stopPropagation(); void translateStory(story); }}>{translating === story.id ? "翻译中…" : translated ? "查看原文" : isEnglish(story) ? "译为中文" : "Translate"}</button>
                  <button className={`save ${saved.includes(story.id) ? "saved" : ""}`} onClick={(e) => { e.stopPropagation(); toggleSaved(story.id); }} aria-label="收藏">{saved.includes(story.id) ? "♥" : "♡"}</button>
                </div>
                <div className="story-body"><div className="story-badges"><span>{story.category}</span><span className={`level ${story.level}`}>{story.level}</span></div>
                  <h2>{translated?.title ?? story.title}</h2><p>{translated?.summary ?? story.summary}</p>
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
            <span className="avatar">{message.role === "user" ? "你" : "✦"}</span><div><p>{message.content}</p>
              {message.citations?.length ? <div className="citations">{message.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer"><b>{citation.source}</b><span>{citation.title}</span>↗</a>)}</div> : null}
            </div></div>)}{asking && <div className="message assistant"><span className="avatar">✦</span><div className="thinking"><i /><i /><i /></div></div>}</div>
          <div className="ask-composer"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder="问任何关于 AI 行业、产品、模型或趋势的问题…" /><div><span>回答将优先引用当前资讯 · Enter 发送</span><button onClick={() => void ask()} disabled={!question.trim() || asking}>发送 <b>↑</b></button></div></div>
        </section>}

        {active === "数据源" && <section className="sources-page reveal">
          <div className="page-intro"><div><span className="eyebrow">SOURCE INTELLIGENCE</span><h1>数据源网络</h1><p>中文资讯优先，同时保留全球实验室、学术与科技媒体的一手信号。</p></div></div>
          <label className="source-search">⌕<input value={sourceQuery} onChange={(e) => setSourceQuery(e.target.value)} placeholder="搜索数据源…" /></label>
          <div className="source-summary"><div><b>{sources.length}</b><span>数据源总数</span></div><div><b>{sources.filter((s) => s.chinese).length}</b><span>中文来源</span></div><div><b>{sources.filter((s) => s.ok).length}</b><span>当前在线</span></div></div>
          <div className="source-list">{sources.filter((source) => source.name.toLowerCase().includes(sourceQuery.toLowerCase())).map((source) => <a href={source.homepage} target="_blank" rel="noreferrer" key={source.name}>
            <span className="source-mark">{source.mark}</span><div><b>{source.name}</b><small>{source.chinese ? "中文资讯" : "国际信源"} · {source.type.toUpperCase()}</small></div>
            <span className={`health ${source.ok ? "ok" : ""}`}>{source.ok ? "在线" : "暂时不可用"}</span><strong>{source.itemCount}<small>条内容</small></strong><i>↗</i>
          </a>)}</div>
        </section>}
      </div>
    </section>

    {selected && <><button className="backdrop" onClick={() => setSelected(null)} aria-label="关闭详情" /><aside className="drawer">
      <div className="drawer-head"><span>AI Brief · 内容洞察</span><button onClick={() => setSelected(null)}>×</button></div>
      <div className="drawer-content">
        <div className="drawer-source"><span className="source-mark">{selected.sourceMark}</span><div><b>{selected.source}</b><small>{formatDate(selected.publishedAt)}</small></div><span className={`trust ${selected.trustLabel}`}>● {selected.trustLabel} {selected.trustScore}</span></div>
        <div className="story-badges"><span>{selected.category}</span><span className={`level ${selected.level}`}>{selected.level}</span></div>
        {(articleDetail?.imageUrl || selected.imageUrl) && <img className="article-image" src={articleDetail?.imageUrl || selected.imageUrl} alt="" />}
        <h2>{translations[selected.id]?.title ?? articleDetail?.title ?? selected.title}</h2>
        <div className="original-meta"><span>{articleDetail?.siteName || selected.source}</span>{articleDetail?.author && <span>作者：{articleDetail.author}</span>}<span>{formatDate(articleDetail?.publishedAt || selected.publishedAt)}</span></div>
        <button className="drawer-translate" onClick={() => void translateStory(selected)}>{translating === selected.id ? "翻译中…" : translations[selected.id] ? "查看原文" : isEnglish(selected) ? "译为中文" : "Translate to English"}</button>
        <section className="drawer-section ai-summary"><span>AI 总结摘要</span>
          {articleLoading ? <div className="summary-loading">正在读取原文并生成摘要…</div> : <p>{translations[selected.id]?.summary ?? articleDetail?.aiSummary ?? selected.summary}</p>}
          {!!articleDetail?.keyPoints?.length && <ul>{articleDetail.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>}
        </section>
        {selected.related >= 3 && <section className="evidence-box"><span>多源验证</span><h3>{selected.related} 个独立来源提及此事件</h3><p>{selected.sourceMentions.join("、")}</p></section>}
        <section className="drawer-section"><span>原文信息</span><p>{articleDetail?.description ?? selected.summary}</p></section>
        <div className="drawer-actions"><button onClick={() => toggleSaved(selected.id)}>{saved.includes(selected.id) ? "♥ 已收藏" : "♡ 收藏"}</button><a href={selected.url} target="_blank" rel="noreferrer">阅读原文 ↗</a></div>
      </div>
    </aside></>}
  </main>;
}
