"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cleanContentText, hasBrokenFactFragment, hasEncodingGarbage, isQualitySummary, isQualityTitle } from "../lib/content-quality";

type Story = {
  id: string; title: string; source: string; sourceMark: string; publishedAt: string; url: string;
  category: string; level: "重要" | "关注" | "一般"; score: number; trustScore: number;
  trustLabel: "高可信" | "较可信" | "待核实"; summary: string; tags: string[];
  related: number; sourceMentions: string[]; imageUrl?: string;
  recommendationReasons?: string[]; importanceReason?: string; eventTitle?: string; eventKey?: string;
  entities?: string[]; keyFacts?: string[];
  scoreBreakdown?: { sourceQuality: number; industryImpact: number; recency: number; multiSource: number; completeness: number; userRelevance?: number };
  uncertainty?: string; trendKey?: string;
  selectionScore?: number; selectionStatus?: "精选" | "候选" | "观察" | "淘汰";
  selectionEvidence?: { hasNewFact: boolean; coreChange: string; containsSpecifics: boolean; evidenceStrength: "强" | "中" | "弱"; likelyRepost: boolean; marketingRisk: boolean; uncertainty: string };
  selectionBreakdown?: { informationGain: number; industryImpact: number; evidenceStrength: number; specificity: number; timeliness: number; userRelevance: number };
  scoringVersion?: string;
};
type SourceStatus = {
  name: string; mark: string; homepage: string; type: string; chinese: boolean;
  trustScore: number; ok: boolean; itemCount: number; health?: "online" | "degraded" | "offline" | "disabled";
  qualityScore?: number; qualityLevel?: string; recommendation?: string; sourceTier?: 1 | 2 | 3; sourceClass?: string;
  successRate?: number; multiSourceRate?: number; noiseRate?: number; recentValidItems?: number;
  lastCheckedAt?: string; lastSuccessAt?: string; completenessRate?: number;
  channelTier?: "T1" | "T1.5" | "T2"; acquisitionMethod?: string; monitoringScope?: string;
  signalDensity?: number; firstReportContribution?: number; averageDiscoveryLatencyMinutes?: number;
  validItemCost?: number; lastManualReviewAt?: string;
};
type ChatMessage = { role: "user" | "assistant"; content: string; citations?: Array<{ title: string; source: string; url: string }>; followUps?: string[] };
type Translation = { title: string; summary: string; target: "zh" | "en" };
type StructuredEvidence = { hasNewFact: boolean; coreChange: string; entities: string[]; containsSpecifics: boolean; industryImpact: string; uncertainties: string[]; likelyRepost: boolean; marketingRisk: boolean };
type ArticleDetail = { title: string; description: string; imageUrl?: string; siteName?: string; author?: string; publishedAt?: string; aiSummary: string; keyPoints: string[]; paragraphs: string[]; structuredEvidence?: StructuredEvidence };
type SelectionFeedback = { opened: number; saved: number; hidden: number; lastActionAt: string; scoringVersion: string };
type CachedArticle = { at: number; detail: ArticleDetail };

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
const relative = (value: string, now: number | null) => {
  if (!now) return "";
  const diff = Math.max(0, now - new Date(value).getTime());
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
const isEditorialSummary = (value = "") => {
  const sentences = value.match(/[^。！？]+[。！？]/g) ?? [];
  const forbidden = /今日高质量资讯仍在聚合|正在整理今天的 AI 核心趋势|请稍后刷新|资讯主要集中在|持续释放.*信号|市场关注度正在上升|值得关注的行业动态/;
  return sentences.length === 3
    && sentences.join("").trim() === value.trim()
    && sentences.every((sentence) =>
      sentence.trim().length >= 38
      && isQualitySummary(sentence, 38)
      && !hasEncodingGarbage(sentence)
      && !hasBrokenFactFragment(sentence)
      && !forbidden.test(sentence)
    );
};
const cleanDisplayTitle = (value = "", source = "") => {
  let text = value
    .replace(/^\s*(?:[（(]?\d{1,2}[)）]?\s*[、,，.:：\-]\s*)+/, "")
    .replace(/(?:\.{3,}|…+)/g, " ").replace(/\s+/g, " ").trim();
  const aliases = [source, source.replace(/\s*(?:科技|新闻|中文|AI|人工智能|开发者社区|开发者|研究院|实验室|学院)$/i, "")].filter((name) => name.length >= 2);
  aliases.forEach((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\s*(?:[-—–_|｜]|·)\\s*${escaped}\\s*$`, "i"), "").trim();
  });
  return text
    .replace(/\s*(?:[-—–_|｜·]\s*)+(?:光明网|新华网|人民网|中国新闻网|央视网|澎湃新闻|品玩|量子位|机器之心|雷峰网|Sohu|搜狐(?:新闻|科技)?|QQ\s*News|腾讯新闻|(?:www\.)?[\w.-]+\.(?:com|cn|net|org)(?:\.cn)?)(?:\s*[-—–_|｜·])?\s*$/i, "")
    .replace(/\s*[（(]\s*(?:来源[:：]?)?\s*(?:Sohu|搜狐(?:新闻|科技)?|QQ\s*News|腾讯新闻|新华网|光明网)\s*[)）]\s*$/i, "")
    .replace(/([A-Za-z]+-\d+(?:\.\d+)*)\.(?=\s*$)/, "$1")
    .trim();
};
const qualityStories = (items: Story[] = []) => items.map((story) => ({
  ...story,
  title: cleanContentText(story.title, story.source),
  summary: cleanContentText(story.summary, story.source),
})).filter((story) =>
  isQualityTitle(story.title, story.source)
  && isQualitySummary(story.summary, 18)
  && !hasEncodingGarbage(`${story.title}${story.summary}`)
);
const sourceCategory = (source: SourceStatus) => {
  if (source.sourceClass) return source.sourceClass;
  const name = source.name.toLowerCase();
  if (/arxiv|mit|research|研究院|实验室|lab|科学院|科学报|papers|stanford|berkeley|智源|之江/.test(name)) return "学术研究";
  if (/openai|anthropic|deepmind|meta ai|nvidia|apple|ibm|salesforce|adobe|stability|mistral|cohere|xai|deepseek|智谱|百川|月之暗面|minimax|零一万物|商汤|讯飞|达摩院|noah|腾讯 ai/.test(name)) return "官方与实验室";
  if (/开发|github|hugging face|csdn|掘金|segment|cloud|云|langchain|llamaindex|vercel|mongodb|databricks|snowflake|replicate|together/.test(name)) return "开发者社区";
  return source.chinese ? "中文科技媒体" : "国际科技媒体";
};
const sourceCategories = ["全部来源", "一手官方来源", "专业科技媒体", "综合新闻媒体", "开发者与社区来源"];
const topicOptions = ["模型发布", "AI Agent", "AI 编程", "中国 AI", "融资", "多模态", "开源项目"];
const matchesTopic = (story: Story, topic: string) => {
  const text = `${story.title} ${story.summary} ${story.category} ${story.tags.join(" ")}`.toLowerCase();
  if (topic === "中国 AI") return story.tags.includes("中文") || /中国|国产|北京|上海|深圳|杭州|deepseek|智谱|通义|文心|豆包/.test(text);
  if (topic === "融资") return /融资|投资|估值|收购|ipo|funding|investment|valuation|acquisition/.test(text);
  if (topic === "开源项目") return story.category === "开源项目" || /开源|open.?source|github/.test(text);
  return story.category === topic || text.includes(topic.toLowerCase());
};
const recommendationReasonsFor = (story: Story, subscribedTopics: string[]) => {
  const followed = subscribedTopics.find((topic) => matchesTopic(story, topic));
  const hiddenReasons = new Set(["相比已有信息增加了新事实", "包含明确数据或时间"]);
  return [...new Set([
    ...(followed ? [`与你关注的“${followed}”相关`] : []),
    ...(story.recommendationReasons ?? []).filter((reason) => !hiddenReasons.has(reason)),
  ])].slice(0, 3);
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [importance, setImportance] = useState("全部级别");
  const [timeRange, setTimeRange] = useState("全部时间");
  const [sort, setSort] = useState("综合排序");
  const [saved, setSaved] = useState<string[]>([]);
  const [selectionFeedback, setSelectionFeedback] = useState<Record<string, SelectionFeedback>>({});
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [reducedSources, setReducedSources] = useState<string[]>([]);
  const [blockedTopics, setBlockedTopics] = useState<string[]>([]);
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
  const [autoPausedSources, setAutoPausedSources] = useState<string[]>([]);
  const [subscribedTopics, setSubscribedTopics] = useState<string[]>([]);
  const [customTopics, setCustomTopics] = useState<string[]>(topicOptions);
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [topicDraft, setTopicDraft] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshMinutes, setRefreshMinutes] = useState(30);
  const [referenceNews, setReferenceNews] = useState(true);
  const [clientNow, setClientNow] = useState<number | null>(null);
  const [syncStage, setSyncStage] = useState("连接数据源");
  const [askStage, setAskStage] = useState("读取实时资讯");
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const resultsRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const articleCacheRef = useRef<Record<string, CachedArticle>>({});
  const feedbackClientIdRef = useRef("");

  const loadNews = useCallback(async (manual = false, disabledOverride?: string[]) => {
    if (manual) setRefreshing(true); else setLoading(true);
    setError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8_500);
    try {
      const disabled = disabledOverride ?? JSON.parse(window.localStorage.getItem("ai-brief-disabled-sources") || "[]") as string[];
      const params = disabled.length ? `?disabled=${encodeURIComponent(disabled.join("|"))}` : "";
      const response = await fetch(`/api/news${params}`, { signal: controller.signal, cache: manual ? "no-store" : "default" });
      if (!response.ok) throw new Error("资讯接口暂时不可用");
      const data = await response.json() as { items: Story[]; sources: SourceStatus[]; updatedAt: string };
      const items = qualityStories(data.items ?? []);
      if (!items.length) throw new Error("资讯质量校验未通过");
      const cleanData = { ...data, items };
      setStories(items); setSources(data.sources ?? []); setUpdatedAt(data.updatedAt);
      window.localStorage.setItem("ai-brief-last-news", JSON.stringify(cleanData));
    } catch {
      const cached = window.localStorage.getItem("ai-brief-last-news");
      if (cached) {
        const data = JSON.parse(cached) as { items: Story[]; sources: SourceStatus[]; updatedAt: string };
        const items = qualityStories(data.items ?? []);
        setStories(items); setSources(data.sources ?? []); setUpdatedAt(data.updatedAt);
        setError(`最新同步暂时延迟，已先展示上次成功获取的 ${items.length} 条资讯。`);
      } else setError("最新同步暂时延迟，正在恢复数据源连接。你可以稍后重试。");
    } finally {
      window.clearTimeout(timer); setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setClientNow(Date.now());
    let feedbackClientId = window.localStorage.getItem("ai-brief-feedback-client-id") || "";
    if (!feedbackClientId) {
      feedbackClientId = crypto.randomUUID();
      window.localStorage.setItem("ai-brief-feedback-client-id", feedbackClientId);
    }
    feedbackClientIdRef.current = feedbackClientId;
    const stored = window.localStorage.getItem("ai-brief-saved");
    if (stored) setSaved(JSON.parse(stored));
    const storedFeedback = window.localStorage.getItem("ai-brief-selection-feedback");
    if (storedFeedback) setSelectionFeedback(JSON.parse(storedFeedback));
    void fetch(`/api/feedback?clientId=${encodeURIComponent(feedbackClientId)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data: { feedback?: Record<string, SelectionFeedback> } | null) => {
        if (data?.feedback) setSelectionFeedback((current) => ({ ...current, ...data.feedback }));
      }).catch(() => undefined);
    const dismissedItems = window.localStorage.getItem("ai-brief-dismissed");
    if (dismissedItems) setDismissed(JSON.parse(dismissedItems));
    const reduced = window.localStorage.getItem("ai-brief-reduced-sources");
    if (reduced) setReducedSources(JSON.parse(reduced));
    const blocked = window.localStorage.getItem("ai-brief-blocked-topics");
    if (blocked) setBlockedTopics(JSON.parse(blocked));
    const articleCache = window.localStorage.getItem("ai-brief-article-cache");
    if (articleCache) {
      try { articleCacheRef.current = JSON.parse(articleCache); } catch { articleCacheRef.current = {}; }
    }
    const summaryCache = window.localStorage.getItem("ai-brief-ai-summary-v10");
    if (summaryCache) {
      try {
        const cached = JSON.parse(summaryCache) as { day?: string; summary?: string };
        if (cached.day === new Date().toISOString().slice(0, 10) && cached.summary && isEditorialSummary(cached.summary)) setAiInsight(cached.summary);
      } catch { /* ignore malformed cache */ }
    }
    const disabled = window.localStorage.getItem("ai-brief-disabled-sources");
    const disabledList = disabled ? JSON.parse(disabled) as string[] : [];
    setDisabledSources(disabledList);
    const autoPaused = window.localStorage.getItem("ai-brief-auto-paused-sources");
    if (autoPaused) setAutoPausedSources(JSON.parse(autoPaused));
    const cachedTranslations = window.localStorage.getItem("ai-brief-translations");
    if (cachedTranslations) setTranslations(JSON.parse(cachedTranslations));
    const topics = window.localStorage.getItem("ai-brief-topics");
    if (topics) setSubscribedTopics(JSON.parse(topics));
    const custom = window.localStorage.getItem("ai-brief-custom-topics");
    if (custom) setCustomTopics(JSON.parse(custom));
    setMotionEnabled(window.localStorage.getItem("ai-brief-motion") !== "off");
    setAutoRefresh(window.localStorage.getItem("ai-brief-auto-refresh") !== "false");
    setRefreshMinutes(Number(window.localStorage.getItem("ai-brief-refresh-minutes")) || 30);
    setSort(window.localStorage.getItem("ai-brief-default-sort") || "综合排序");
    setReferenceNews(window.localStorage.getItem("ai-brief-reference-news") !== "false");
    const preferredLanguage = window.localStorage.getItem("ai-brief-content-language");
    if (preferredLanguage === "zh" || preferredLanguage === "en") setContentLanguage(preferredLanguage);
    const cachedNews = window.localStorage.getItem("ai-brief-last-news");
    if (cachedNews) {
      try {
        const data = JSON.parse(cachedNews) as { items: Story[]; sources: SourceStatus[]; updatedAt: string };
        const items = qualityStories(data.items ?? []);
        if (items.length) {
          setStories(items); setSources(data.sources ?? []); setUpdatedAt(data.updatedAt); setLoading(false);
        }
      } catch { /* fetch a fresh copy below */ }
    }
    void loadNews(false, disabledList);
  }, [loadNews]);
  useEffect(() => { window.localStorage.setItem("ai-brief-saved", JSON.stringify(saved)); }, [saved]);
  useEffect(() => { window.localStorage.setItem("ai-brief-selection-feedback", JSON.stringify(selectionFeedback)); }, [selectionFeedback]);
  useEffect(() => { window.localStorage.setItem("ai-brief-dismissed", JSON.stringify(dismissed)); }, [dismissed]);
  useEffect(() => { window.localStorage.setItem("ai-brief-reduced-sources", JSON.stringify(reducedSources)); }, [reducedSources]);
  useEffect(() => { window.localStorage.setItem("ai-brief-blocked-topics", JSON.stringify(blockedTopics)); }, [blockedTopics]);
  useEffect(() => { window.localStorage.setItem("ai-brief-disabled-sources", JSON.stringify(disabledSources)); }, [disabledSources]);
  useEffect(() => { window.localStorage.setItem("ai-brief-auto-paused-sources", JSON.stringify(autoPausedSources)); }, [autoPausedSources]);
  useEffect(() => { window.localStorage.setItem("ai-brief-translations", JSON.stringify(translations)); }, [translations]);
  useEffect(() => { window.localStorage.setItem("ai-brief-topics", JSON.stringify(subscribedTopics)); }, [subscribedTopics]);
  useEffect(() => { window.localStorage.setItem("ai-brief-custom-topics", JSON.stringify(customTopics)); }, [customTopics]);
  useEffect(() => { window.localStorage.setItem("ai-brief-motion", motionEnabled ? "on" : "off"); }, [motionEnabled]);
  useEffect(() => { window.localStorage.setItem("ai-brief-auto-refresh", String(autoRefresh)); }, [autoRefresh]);
  useEffect(() => { window.localStorage.setItem("ai-brief-refresh-minutes", String(refreshMinutes)); }, [refreshMinutes]);
  useEffect(() => { window.localStorage.setItem("ai-brief-default-sort", sort); }, [sort]);
  useEffect(() => { window.localStorage.setItem("ai-brief-reference-news", String(referenceNews)); }, [referenceNews]);
  useEffect(() => { window.localStorage.setItem("ai-brief-content-language", contentLanguage); }, [contentLanguage]);
  useEffect(() => {
    if (!sources.length) return;
    type QualitySnapshot = { day: string; score: number };
    const key = "ai-brief-source-quality-history";
    const today = new Date().toISOString().slice(0, 10);
    let history: Record<string, QualitySnapshot[]> = {};
    try { history = JSON.parse(window.localStorage.getItem(key) || "{}"); } catch { history = {}; }
    const shouldPause: string[] = [];
    sources.forEach((source) => {
      if (source.qualityScore === undefined) return;
      const snapshots = (history[source.name] ?? []).filter((item) => item.day !== today);
      snapshots.push({ day: today, score: source.qualityScore });
      history[source.name] = snapshots.slice(-30);
      const recent = history[source.name].slice(-3);
      if (recent.length === 3 && recent.every((item) => item.score < 45)) shouldPause.push(source.name);
    });
    window.localStorage.setItem(key, JSON.stringify(history));
    if (!shouldPause.length) return;
    setAutoPausedSources((current) => [...new Set([...current, ...shouldPause])]);
    setDisabledSources((current) => [...new Set([...current, ...shouldPause])]);
  }, [sources]);
  useEffect(() => {
    if (!loading && !refreshing) return;
    setSyncStage("连接数据源");
    const first = window.setTimeout(() => setSyncStage("聚合相同事件"), 900);
    const second = window.setTimeout(() => setSyncStage("生成今日摘要"), 2_100);
    return () => { window.clearTimeout(first); window.clearTimeout(second); };
  }, [loading, refreshing]);
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => void loadNews(true), refreshMinutes * 60_000);
    return () => window.clearInterval(timer);
  }, [autoRefresh, loadNews, refreshMinutes]);
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
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); searchInputRef.current?.focus(); setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const filtered = useMemo(() => {
    const result = stories.filter((story) => {
      const text = `${story.title}${story.summary}${story.source}${story.tags.join("")}`.toLowerCase();
      return (!query || text.includes(query.toLowerCase()))
        && (importance === "全部级别" || story.level === importance)
        && (timeRange === "全部时间" || Date.now() - new Date(story.publishedAt).getTime() <= (timeRange === "24小时" ? 86_400_000 : timeRange === "3天" ? 259_200_000 : 604_800_000))
        && !disabledSources.includes(story.source)
        && !dismissed.includes(story.id)
        && !blockedTopics.some((topic) => matchesTopic(story, topic))
        && (active !== "我的收藏" || saved.includes(story.id));
    });
    const topicBoost = (story: Story) => active === "今日资讯" && subscribedTopics.some((topic) => matchesTopic(story, topic)) ? 10 : 0;
    const sourcePenalty = (story: Story) => {
      const quality = sources.find((source) => source.name === story.source)?.qualityScore ?? 72;
      const dynamicPenalty = quality < 48 ? 28 : quality < 65 ? 12 : 0;
      return dynamicPenalty + (reducedSources.includes(story.source) ? 20 : 0);
    };
    const feedbackBoost = (story: Story) => {
      const feedback = selectionFeedback[story.id];
      return feedback ? Math.min(8, feedback.saved * 4 + feedback.opened - feedback.hidden * 8) : 0;
    };
    return result.sort((a, b) => sort === "时间优先"
      ? new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      : sort === "多源提及优先" ? b.related - a.related
      : (topicBoost(b) + (b.selectionScore ?? b.score) + b.related * 3 + feedbackBoost(b) - sourcePenalty(b))
        - (topicBoost(a) + (a.selectionScore ?? a.score) + a.related * 3 + feedbackBoost(a) - sourcePenalty(a)));
  }, [stories, query, importance, timeRange, disabledSources, dismissed, blockedTopics, reducedSources, active, saved, sort, subscribedTopics, sources, selectionFeedback]);

  const topStories = filtered.slice(0, 5);
  const pageSize = 13;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [query, importance, timeRange, active, sort]);

  const recordSelectionFeedback = (story: Story, action: "opened" | "saved" | "hidden") => {
    setSelectionFeedback((current) => {
      const previous = current[story.id] ?? { opened: 0, saved: 0, hidden: 0, lastActionAt: "", scoringVersion: story.scoringVersion || "legacy" };
      return { ...current, [story.id]: {
        ...previous,
        [action]: previous[action] + 1,
        lastActionAt: new Date().toISOString(),
        scoringVersion: story.scoringVersion || previous.scoringVersion,
      } };
    });
    if (feedbackClientIdRef.current) {
      void fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          clientId: feedbackClientIdRef.current,
          storyId: story.id,
          action,
          scoringVersion: story.scoringVersion || "legacy",
          source: story.source,
          category: story.category,
          eventKey: story.eventKey || "",
        }),
      }).catch(() => undefined);
    }
  };
  const toggleSaved = (id: string) => {
    const story = stories.find((item) => item.id === id);
    if (story && !saved.includes(id)) recordSelectionFeedback(story, "saved");
    setSaved((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  };
  const dismissStory = (story: Story, mode: "story" | "source" | "topic") => {
    recordSelectionFeedback(story, "hidden");
    if (mode === "story") setDismissed((items) => [...new Set([...items, story.id])]);
    if (mode === "source") setReducedSources((items) => [...new Set([...items, story.source])]);
    if (mode === "topic") setBlockedTopics((items) => [...new Set([...items, story.category])]);
  };
  const toggleSource = (name: string) => {
    const next = disabledSources.includes(name) ? disabledSources.filter((item) => item !== name) : [...disabledSources, name];
    if (disabledSources.includes(name)) setAutoPausedSources((items) => items.filter((item) => item !== name));
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
  const deleteTopic = (topic: string) => {
    setCustomTopics((items) => items.filter((item) => item !== topic));
    setSubscribedTopics((items) => items.filter((item) => item !== topic));
    setBlockedTopics((items) => items.filter((item) => item !== topic));
    if (editingTopic === topic) { setEditingTopic(null); setTopicDraft(""); }
  };
  const displayed = (story: Story) => {
    const originalMatches = contentLanguage === "en" ? isEnglish(story) : !isEnglish(story);
    const translated = translations[story.id];
    return !originalMatches && translated?.target === contentLanguage ? translated : { title: story.title, summary: story.summary };
  };
  const openStory = (story: Story) => {
    const articleKey = `v2::${story.url}::${story.title}`;
    const cached = articleCacheRef.current[articleKey];
    const fallback: ArticleDetail = {
      title: story.title, description: completeSummary(story.summary), imageUrl: story.imageUrl,
      siteName: story.source, publishedAt: story.publishedAt,
      aiSummary: completeSummary(story.summary), keyPoints: [], paragraphs: [],
    };
    recordSelectionFeedback(story, "opened");
    setSelected(story);
    setArticleDetail(cached?.detail ?? fallback);
    setArticleLoading(!cached);
    if (cached && Date.now() - cached.at < 24 * 60 * 60_000) return;
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
        aiSummary?: string; keyPoints?: string[]; structuredEvidence?: StructuredEvidence;
      }) => {
        const detail = {
        title: data.title || story.title,
        description: data.description || story.summary,
        imageUrl: data.imageUrl || story.imageUrl,
        publishedAt: data.publishedAt || story.publishedAt,
        siteName: data.siteName || story.source,
        author: data.author,
        aiSummary: data.aiSummary || data.description || story.summary,
        keyPoints: data.keyPoints || [],
        paragraphs: data.paragraphs || [],
        structuredEvidence: data.structuredEvidence,
        };
        setArticleDetail(detail);
        articleCacheRef.current[articleKey] = { at: Date.now(), detail };
        const entries = Object.entries(articleCacheRef.current).sort(([, a], [, b]) => b.at - a.at).slice(0, 40);
        articleCacheRef.current = Object.fromEntries(entries);
        window.localStorage.setItem("ai-brief-article-cache", JSON.stringify(articleCacheRef.current));
      })
      .catch(() => setArticleDetail((current) => current ?? fallback)).finally(() => setArticleLoading(false));
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

  const insight = topStories.length
    ? topStories.slice(0, 3).map((story) => {
      const title = cleanDisplayTitle(story.title, story.source);
      const detail = completeSummary(story.summary).match(/^[\s\S]*?[。！？.!?]/)?.[0] ?? "";
      return completeSummary(detail && !title.includes(detail.replace(/[。！？.!?]$/, "")) ? `${title}：${detail}` : title);
    }).join("")
    : "正在读取最新资讯，完成后将展示今天最值得关注的三个具体变化。";
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
    if (!stories.length || aiInsight) return;
    const controller = new AbortController();
    const summaryStories = [...stories]
      .sort((a, b) =>
        (b.score + b.trustScore * .35 + b.related * 4) -
        (a.score + a.trustScore * .35 + a.related * 4)
      )
      .slice(0, 48);
    const requestSummary = async () => {
      // The GET endpoint is pre-warmed daily and normally returns from the edge cache.
      // POST remains a quality-preserving fallback when today's corpus changed.
      let response = await fetch("/api/summary", { signal: controller.signal });
      let data = await response.json().catch(() => ({})) as { summary?: string };
      if (!response.ok || !data.summary || !isEditorialSummary(data.summary)) {
        response = await fetch("/api/summary", {
          method: "POST", signal: controller.signal, headers: { "content-type": "application/json" },
          body: JSON.stringify({ stories: summaryStories }),
        });
        data = await response.json() as { summary?: string };
      }
      return data;
    };
    void requestSummary().then((data: { summary?: string }) => {
      if (data.summary) {
        if (!isEditorialSummary(data.summary)) return;
        setAiInsight(data.summary);
        window.localStorage.setItem("ai-brief-ai-summary-v10", JSON.stringify({
          day: new Date().toISOString().slice(0, 10),
          summary: data.summary,
        }));
      }
    }).catch(() => undefined);
    return () => controller.abort();
  }, [aiInsight, stories]);
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
      ...articleDetail.paragraphs.slice(0, 10).map((paragraph, index) => ({ id: `${prefix}:paragraph:${index}`, title: `正文 ${index + 1}`, summary: paragraph })),
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
    window.localStorage.removeItem("ai-brief-ai-summary");
    window.localStorage.removeItem("ai-brief-ai-summary-v2");
    window.localStorage.removeItem("ai-brief-ai-summary-v3");
    window.localStorage.removeItem("ai-brief-ai-summary-v4");
    window.localStorage.removeItem("ai-brief-ai-summary-v5");
    window.localStorage.removeItem("ai-brief-ai-summary-v6");
    window.localStorage.removeItem("ai-brief-ai-summary-v7");
    window.localStorage.removeItem("ai-brief-ai-summary-v8");
    window.localStorage.removeItem("ai-brief-ai-summary-v9");
    window.localStorage.removeItem("ai-brief-ai-summary-v10");
    window.localStorage.removeItem("ai-brief-article-cache");
    articleCacheRef.current = {};
    setAiInsight("");
    setTranslations({});
    void loadNews(true);
  };
  const feedbackTotals = Object.values(selectionFeedback).reduce((totals, item) => ({
    opened: totals.opened + item.opened,
    saved: totals.saved + item.saved,
    hidden: totals.hidden + item.hidden,
  }), { opened: 0, saved: 0, hidden: 0 });
  const selectionStats = {
    selected: stories.filter((story) => story.selectionStatus === "精选").length,
    candidate: stories.filter((story) => story.selectionStatus === "候选").length,
    observing: stories.filter((story) => story.selectionStatus === "观察").length,
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
        <div className="search-shell">
          <label className="global-search"><span>⌕</span><input ref={searchInputRef} value={query}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearchOpen(false);
              if (event.key === "Enter") {
                setActive("今日资讯"); setPage(1); setSearchOpen(false);
                window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
              }
            }}
            placeholder="搜索公司、模型、产品或议题…" /><kbd>⌘ K</kbd>
          </label>
          {searchOpen && query.trim() && <div className="search-results">
            <div><b>找到 {filtered.length} 条相关资讯</b><button onClick={() => { setQuery(""); setSearchOpen(false); }}>清除</button></div>
            {filtered.slice(0, 5).map((story) => <button key={story.id} onMouseDown={(event) => event.preventDefault()} onClick={() => {
              setActive("今日资讯"); setSearchOpen(false); openStory(story);
            }}><span>{story.source}</span><strong>{cleanDisplayTitle(story.title, story.source)}</strong><i>↗</i></button>)}
            {!filtered.length && <p>没有直接匹配的资讯，试试公司简称、模型名称或更短的关键词。</p>}
            {!!filtered.length && <button className="view-all-search" onClick={() => {
              setActive("今日资讯"); setPage(1); setSearchOpen(false);
              window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
            }}>查看全部搜索结果 →</button>}
          </div>}
        </div>
      </header>

      <div className="content page-stage" key={active}>
        {(active === "今日资讯" || active === "我的收藏") && <>
          <section className="page-intro reveal">
            <div className="intro-heading">{active === "今日资讯" && <time className="calendar-date"><span className="calendar-month"><b>{clientNow ? new Date(clientNow).getMonth() + 1 : "—"}</b><small>月</small></span><strong>{clientNow ? new Date(clientNow).getDate() : "—"}<small>日</small></strong><span className="calendar-meta"><b>今日</b><small>{clientNow ? new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(new Date(clientNow)) : "—"}</small></span></time>}<div className="intro-copy"><span className="eyebrow">AI SIGNAL DESK</span>
              <h1>{active === "我的收藏" ? "我的收藏" : "今日资讯"}</h1>
              <p>{active === "我的收藏" ? "你保存的高价值内容，随时回来继续阅读。" : "从海量动态中提炼值得关注、值得相信、值得行动的事件。"}</p></div>
            </div>
            <div className="live-cluster">
              <div className={`live-status ${loading || refreshing ? "working" : ""}`}><span /><b>{loading || refreshing ? syncStage : "实时更新"}</b><small>{updatedAt ? `最近同步 ${formatDate(updatedAt)}` : "准备同步"}</small></div>
              {active === "今日资讯" && <button className={`refresh ${refreshing ? "spinning" : ""}`} onClick={() => void loadNews(true)} disabled={refreshing}><span>↻</span>{refreshing ? "同步中" : "刷新资讯"}</button>}
            </div>
          </section>

          {active === "今日资讯" && <section className="brief-hero reveal delay-1">
            <div className="brief-copy"><span className="hero-kicker">✦ AI 总结</span>{loading && !stories.length ? <h2>正在读取本地缓存，稍后自动同步最新资讯。</h2> : <ul className="insight-points">{insightPoints.map((point, index) => <li key={`${index}-${point}`}><i>{index + 1}</i><span>{point}</span></li>)}</ul>}</div>
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
                <button className="delete-topic" onClick={() => deleteTopic(topic)} aria-label={`删除${topic}`}>×</button>
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
          <div className="result-meta" ref={resultsRef}><span><b>{filtered.length}</b> 条资讯</span>
            <div className="result-actions"><div className={`page-language ${pageTranslating ? "loading" : ""}`} aria-label="页面语言">
              <button className={contentLanguage === "zh" ? "active" : ""} onClick={() => setContentLanguage("zh")}>中文</button>
              <button className={contentLanguage === "en" ? "active" : ""} onClick={() => setContentLanguage("en")}>EN</button>
              {pageTranslating && <span>翻译中…</span>}
            </div></div>
          </div>

          {loading && !stories.length ? <div className="skeleton-grid">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton" />)}</div>
            : paged.length ? <section className="story-grid editorial">
              {paged.map((story, index) => {
                const translated = displayed(story);
                return <article className={`story-card ${index === 0 ? "lead" : ""}`} style={{ "--card-order": index } as React.CSSProperties} key={story.id} onClick={() => openStory(story)}>
                <div className="story-head"><span className="source-mark">{story.sourceMark}</span><div><b>{story.source}</b><small>{relative(story.publishedAt, clientNow)}</small></div>
                  <div className="story-actions"><button className={`save ${saved.includes(story.id) ? "saved" : ""}`} onClick={(e) => { e.stopPropagation(); toggleSaved(story.id); }} aria-label="收藏">{saved.includes(story.id) ? "♥" : "♡"}</button>
                    <details onClick={(event) => event.stopPropagation()}><summary aria-label="内容反馈">···</summary><div>
                      <button onClick={() => dismissStory(story, "story")}>不看这条资讯</button>
                      <button onClick={() => dismissStory(story, "source")}>减少“{story.source}”</button>
                      <button onClick={() => dismissStory(story, "topic")}>减少“{story.category}”</button>
                    </div></details>
                  </div>
                </div>
                <div className="story-body"><div className="story-badges"><span>{story.category}</span><span className={`selection-state state-${story.selectionStatus || "候选"}`}>{story.selectionStatus || "候选"}</span><span className={`level ${story.level}`}>{story.level}</span></div>
                  <h2>{cleanDisplayTitle(translated.title, story.source)}</h2><p>{completeSummary(translated.summary)}</p>
                  {!!recommendationReasonsFor(story, subscribedTopics).length && <div className="recommendation-reasons" aria-label="推荐原因">
                    {recommendationReasonsFor(story, subscribedTopics).slice(0, 2).map((reason) => <span key={reason}>{reason}</span>)}
                  </div>}
                </div>
                <div className="story-foot"><span>{story.related >= 3 ? <><b className="multi-source">{story.related} 个来源提及</b> · {story.sourceMentions.slice(0, 3).join("、")}</> : null}</span><button>阅读洞察 <i>→</i></button></div>
              </article>;})}
            </section> : <div className="empty"><span>◇</span><h3>没有符合条件的内容</h3><p>调整筛选条件，或刷新获取最新资讯。</p></div>}

          {totalPages > 1 && <div className="pagination source-pagination"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>← 上一页</button><div>{Array.from({ length: totalPages }, (_, index) => index + 1).slice(Math.max(0, page - 3), Math.min(totalPages, page + 2)).map((item) => <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>{item}</button>)}</div><button disabled={page === totalPages} onClick={() => setPage((value) => value + 1)}>下一页 →</button></div>}
        </>}

        {active === "AI 问答" && <section className="ask-page reveal">
          <div className="ask-header"><span className="ask-orb">✦</span><span className="eyebrow">AI BRIEF RESEARCH ASSISTANT</span><h1>问清正在发生的 AI</h1><p>把新闻线索、对话背景与公开信息连接起来，给出清晰判断和可核查出处。</p></div>
          <div className={`research-mode ${referenceNews ? "on" : ""}`}>
            <div><span>资讯增强模式</span><b>{referenceNews ? "已开启：回答会优先引用资讯库与公开信息" : "已关闭：仅根据当前对话回答"}</b><p>开启后，DeepSeek 会检索当前聚合资讯、相关新闻和历史对话，进行多来源比较，并在答案下方附上可核查的原文出处。</p></div>
            <button className={referenceNews ? "on" : ""} onClick={() => setReferenceNews((value) => !value)} role="switch" aria-checked={referenceNews}><i /><strong>{referenceNews ? "已开启" : "开启"}</strong></button>
          </div>
          {!messages.length && <div className="suggestions">{["今天最重要的 AI 变化是什么？","最近有哪些新模型发布？","哪些新闻得到了多个来源印证？","总结中国 AI 行业近期趋势"].map((item) => <button key={item} onClick={() => void ask(item)}><span>↗</span>{item}</button>)}</div>}
          <div className="chat-stream">{messages.map((message, index) => <div className={`message ${message.role}`} key={index}>
            <span className="avatar">{message.role === "user" ? "你" : "✦"}</span><div>{message.role === "assistant" ? <AnswerContent content={message.content} /> : <p>{message.content}</p>}
              {message.citations?.length ? <div className="citations">{message.citations.map((citation) => <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer"><b>{citation.source}</b><span>{citation.title}</span>↗</a>)}</div> : null}
              {message.role === "assistant" && message.followUps?.length ? <div className="follow-ups"><span>继续研究</span>{message.followUps.map((item) => <button key={item} onClick={() => void ask(item)} disabled={asking}><i>↗</i>{item}</button>)}</div> : null}
            </div></div>)}{asking && <div className="message assistant generating"><span className="avatar">✦</span><div className="thinking"><span>{askStage}</span><div><i /><i /><i /></div><b><em /></b></div></div>}<div ref={chatEndRef} /></div>
          <div className="ask-composer"><textarea value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void ask(); } }} placeholder="问任何关于 AI 行业、产品、模型或趋势的问题…" /><div><span>{referenceNews ? "将结合资讯库与公开信息 · Enter 发送" : "仅根据当前对话 · Enter 发送"}</span><button onClick={() => void ask()} disabled={!question.trim() || asking}>发送 <b>↑</b></button></div></div>
        </section>}

        {active === "数据源网络" && <section className="sources-page reveal">
          <div className="page-intro"><div><span className="eyebrow">SOURCE INTELLIGENCE</span><h1>数据源网络</h1><p>连接全球实验室、学术机构与科技媒体，持续汇集可靠的一手信号。</p></div></div>
          <label className="source-search">⌕<input value={sourceQuery} onChange={(e) => setSourceQuery(e.target.value)} placeholder="搜索数据源…" /></label>
          <div className="source-summary"><div><b>{sources.length}</b><span>数据源总数</span></div><div><b>{sources.filter((source) => !disabledSources.includes(source.name)).length}</b><span>已启用数据源</span></div><div><b>{sources.filter((s) => s.ok).length}</b><span>在线数据源</span></div><div><b>{sources.filter((source) => (source.qualityScore ?? 100) < 65).length}</b><span>观察与降权来源</span></div></div>
          <details className="source-method">
            <summary>查看数据源准入与动态淘汰方法 <span>＋</span></summary>
            <div><p><b>分层准入</b> 一手官方来源优先，专业科技媒体与综合媒体补充分析和商业信息，开发者社区用于发现早期技术信号。</p><p><b>动态评分</b> 综合抓取成功率、有效内容、信息完整度、多源印证率和噪音率；低分来源自动降权，连续三个统计日低于阈值后暂停抓取，仍可手动重新启用。</p><p><b>质量闸门</b> 所有内容进入首页前均经过乱码、尾缀、标题与摘要完整性、AI 相关性、营销噪音、合集拆分、事件聚合和排序检查。</p></div>
          </details>
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
              <div className="source-tags"><span>{source.sourceClass || (source.chinese ? "中文科技媒体" : "国际科技媒体")}</span><span className="channel-tier">{source.channelTier || "T2"}</span><span>{source.acquisitionMethod || (source.type === "atom" ? "Atom" : "RSS / 聚合")}</span><span className={`quality-level q-${source.qualityLevel || "正常"}`}>{source.qualityLevel || "正常"}</span></div>
              <p className="monitoring-scope">{source.monitoringScope || "AI 相关内容，经质量闸门过滤"}</p>
              <div className="source-quality-grid">
                <span><b>{source.qualityScore ?? "—"}</b><small>动态质量分</small></span>
                <span><b>{source.successRate ?? "—"}{source.successRate !== undefined ? "%" : ""}</b><small>抓取成功率</small></span>
                <span><b>{source.signalDensity ?? "—"}{source.signalDensity !== undefined ? "%" : ""}</b><small>信号密度</small></span>
                <span><b>{source.firstReportContribution ?? "—"}{source.firstReportContribution !== undefined ? "%" : ""}</b><small>首发贡献度</small></span>
                <span><b>{source.multiSourceRate ?? "—"}{source.multiSourceRate !== undefined ? "%" : ""}</b><small>多源印证率</small></span>
                <span><b>{source.noiseRate ?? "—"}{source.noiseRate !== undefined ? "%" : ""}</b><small>噪音率</small></span>
              </div>
              <div className="source-tag-meta"><span className={`health ${source.health === "degraded" ? "degraded" : source.ok ? "ok" : ""}`}>{autoPausedSources.includes(source.name) ? "低质自动暂停" : source.health === "degraded" ? "网络波动" : source.ok ? "在线" : enabled ? "暂时不可用" : "已停用"}</span><span>近30天 {source.recentValidItems ?? source.itemCount} 条有效资讯</span><span>{source.recommendation || "保持当前权重"}</span><span>复核：{source.lastManualReviewAt || "待安排"}</span><a href={source.homepage} target="_blank" rel="noreferrer">访问来源 ↗</a></div>
            </article>;
          })}</div>
          {sourceTotalPages > 1 && <div className="pagination source-pagination"><button disabled={sourcePage === 1} onClick={() => setSourcePage((value) => value - 1)}>← 上一页</button><div>{Array.from({ length: sourceTotalPages }, (_, index) => index + 1).slice(Math.max(0, sourcePage - 3), Math.min(sourceTotalPages, sourcePage + 2)).map((item) => <button key={item} className={sourcePage === item ? "active" : ""} onClick={() => setSourcePage(item)}>{item}</button>)}</div><button disabled={sourcePage === sourceTotalPages} onClick={() => setSourcePage((value) => value + 1)}>下一页 →</button></div>}
        </section>}

        {active === "设置" && <section className="settings-page reveal">
          <div className="page-intro"><div><span className="eyebrow">WORKSPACE SETTINGS</span><h1>设置</h1><p>管理阅读偏好、动效、模型状态与管理员信息。</p></div></div>
          <div className="settings-grid">
            <section className="settings-card admin-card"><span className="settings-label">管理员</span><div className="admin-profile"><i>周</i><div><h3>周 玉川</h3><p>AI Brief 管理员</p></div><b>OWNER</b></div><div className="admin-meta"><span>工作区<b>AI Brief</b></span><span>数据网络<b>{sources.length || 218} 个来源</b></span><span>在线状态<b>{sources.filter((item) => item.ok).length} 个在线</b></span></div></section>
            <section className="settings-card model-card"><span className="settings-label">AI 模型</span><div className="model-status"><i>◆</i><div><h3>DeepSeek</h3><p>总结、翻译、详情摘要与研究问答</p></div><span><i /> 已连接</span></div><small>模型密钥由 Vercel Production 环境安全管理，不写入浏览器或 GitHub。</small></section>
            <section className="settings-card preference-card"><span className="settings-label">阅读偏好</span><div className="setting-row"><div><b>默认内容语言</b><small>{pageTranslating ? "正在翻译首页、收藏和资讯详情…" : `当前使用${contentLanguage === "zh" ? "中文" : "英文"}，重新打开网站后仍会保留`}</small></div><div className="setting-options"><button className={contentLanguage === "zh" ? "active" : ""} onClick={() => setContentLanguage("zh")}>中文</button><button className={contentLanguage === "en" ? "active" : ""} onClick={() => setContentLanguage("en")}>English</button></div></div><div className="setting-row"><div><b>界面动效</b><small>控制页面切换、信号波形与卡片反馈</small></div><button className={`settings-toggle ${motionEnabled ? "on" : ""}`} onClick={() => setMotionEnabled((value) => !value)} role="switch" aria-checked={motionEnabled}><i /></button></div><div className="setting-row"><div><b>内容反馈</b><small>已隐藏 {dismissed.length} 条，已降低 {reducedSources.length} 个来源和 {blockedTopics.length} 个主题</small></div><button className="reset-feedback" disabled={!dismissed.length && !reducedSources.length && !blockedTopics.length} onClick={() => { setDismissed([]); setReducedSources([]); setBlockedTopics([]); }}>恢复全部</button></div></section>
            <section className="settings-card preference-card"><span className="settings-label">更新与排序</span><div className="setting-row"><div><b>自动更新资讯</b><small>{autoRefresh ? `每 ${refreshMinutes} 分钟在后台同步一次` : "仅在点击刷新资讯时同步"}</small></div><button className={`settings-toggle ${autoRefresh ? "on" : ""}`} onClick={() => setAutoRefresh((value) => !value)} role="switch" aria-checked={autoRefresh}><i /></button></div><div className="setting-row"><div><b>更新频率</b><small>调整自动同步间隔</small></div><div className="setting-options">{[15,30,60].map((minutes) => <button key={minutes} className={refreshMinutes === minutes ? "active" : ""} onClick={() => setRefreshMinutes(minutes)}>{minutes} 分钟</button>)}</div></div><div className="setting-row"><div><b>默认首页排序</b><small>设置每次打开网站时的默认信息流顺序</small></div><div className="setting-options">{[["综合排序","精选"],["时间优先","最新"],["多源提及优先","多源"]].map(([value,label]) => <button key={value} className={sort === value ? "active" : ""} onClick={() => setSort(value)}>{label}</button>)}</div></div></section>
            <section className="settings-card selection-card"><span className="settings-label">精选策略与反馈</span><div className="selection-version"><div><h3>{stories[0]?.scoringVersion || "selection-v12.0"}</h3><p>DeepSeek提取结构化证据，规则引擎负责事件评分与最终精选。</p></div><b>ACTIVE</b></div><div className="selection-metrics"><span><b>{selectionStats.selected}</b><small>精选</small></span><span><b>{selectionStats.candidate}</b><small>候选</small></span><span><b>{selectionStats.observing}</b><small>观察</small></span><span><b>{feedbackTotals.opened}</b><small>阅读反馈</small></span><span><b>{feedbackTotals.saved}</b><small>收藏反馈</small></span><span><b>{feedbackTotals.hidden}</b><small>屏蔽反馈</small></span></div></section>
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
          {articleLoading && <div className="detail-progress"><i />正在补充原文与深度摘要，现有信息可先阅读</div>}
          {detailTranslating ? <div className="summary-loading">正在翻译完整详情…</div> : <p>{translations[`__detail:${selected.id}:main`]?.target === contentLanguage ? translations[`__detail:${selected.id}:main`].summary : articleDetail?.aiSummary || displayed(selected).summary || selected.summary}</p>}
          {!!articleDetail?.keyPoints?.length && <ul>{articleDetail.keyPoints.map((point, index) => {
            const translatedPoint = translations[`__detail:${selected.id}:point:${index}`];
            const sentence = oneSentence(translatedPoint?.target === contentLanguage ? translatedPoint.summary : point);
            return sentence ? <li key={point}><strong>{sentence}</strong></li> : null;
          })}</ul>}
        </section>
        <section className="drawer-section recommendation-explain"><span>为什么推荐</span>
          <div className="explain-grid">
            <div><b>发生了什么</b><p>{articleDetail?.structuredEvidence?.coreChange || selected.selectionEvidence?.coreChange || completeSummary(displayed(selected).summary || selected.summary)}</p></div>
            <div><b>新增了什么</b><p>{articleDetail?.structuredEvidence?.hasNewFact || selected.selectionEvidence?.hasNewFact ? "相较已有报道，这条信息包含新的产品动作、具体事实或可验证细节。" : "当前信息增量有限，主要用于补充既有事件的证据和背景。"}</p></div>
            <div><b>行业影响</b><p>{articleDetail?.structuredEvidence?.industryImpact || selected.importanceReason || "这项变化可能影响 AI 产品落地、技术路线或行业竞争格局。"}</p></div>
            <div><b>排序原因</b><p>{recommendationReasonsFor(selected, subscribedTopics).length ? recommendationReasonsFor(selected, subscribedTopics).join("；") + "。" : "内容信息完整，并与当前 AI 行业变化直接相关。"}</p></div>
            <div><b>不确定性</b><p>{articleDetail?.structuredEvidence?.uncertainties?.join("；") || selected.selectionEvidence?.uncertainty || selected.uncertainty || (selected.related >= 3 ? "主要事实已获得多源印证，后续影响仍需持续观察。" : "当前独立来源仍然有限，关键细节需要进一步验证。")}</p></div>
          </div>
          {!!selected.entities?.length && <div className="entity-row"><b>涉及对象</b>{selected.entities.map((entity) => <span key={entity}>{entity}</span>)}</div>}
          {selected.trendKey && <div className="entity-row"><b>所属趋势</b><span>{selected.trendKey}</span></div>}
        </section>
        {selected.related >= 3 && <section className="evidence-box"><span>多源验证</span><h3>{selected.related} 个独立来源提及此事件</h3><p>{selected.sourceMentions.join("、")}</p></section>}
        <section className="drawer-section original-content"><span>原文信息</span>
          <p>{translations[`__detail:${selected.id}:description`]?.target === contentLanguage ? translations[`__detail:${selected.id}:description`].summary : articleDetail?.description ?? displayed(selected).summary}</p>
          {articleDetail?.paragraphs?.slice(0, 10).map((paragraph, index) => {
            const translatedParagraph = translations[`__detail:${selected.id}:paragraph:${index}`];
            return <p key={`${index}-${paragraph.slice(0, 20)}`}>{translatedParagraph?.target === contentLanguage ? translatedParagraph.summary : paragraph}</p>;
          })}
        </section>
        <div className="drawer-actions"><button onClick={() => toggleSaved(selected.id)}>{saved.includes(selected.id) ? "♥ 已收藏" : "♡ 收藏"}</button><a href={selected.url} target="_blank" rel="noreferrer">阅读原文 ↗</a></div>
      </div>
    </aside></>}
  </main>;
}
