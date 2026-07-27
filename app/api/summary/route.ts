import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";

type SummaryStory = {
  title: string; source: string; summary: string; category: string;
  related?: number; sourceMentions?: string[]; publishedAt?: string;
  score?: number; trustScore?: number;
};

const summaryCache = new Map<string, { at: number; summary: string }>();
const cleanStoryText = (value = "") => value
  .replace(/^\s*(?:[（(]?\d{1,2}[)）]?\s*[、,，.:：\-]\s*)+/, "")
  .replace(/\s*(?:[-—–_|｜·]\s*)+(?:Sohu|搜狐(?:新闻|科技)?|QQ\s*News|腾讯新闻|新华网|光明网|人民网)(?:\s*[-—–_|｜·])?\s*$/gi, "")
  .replace(/([A-Za-z]+-\d+(?:\.\d+)*)\.(?=\s*$)/, "$1")
  .replace(/[，,]\s*[。.!！]/g, "。")
  .replace(/\s+/g, " ").trim();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { stories?: SummaryStory[] };
  const stories = (body.stories ?? []).map((story) => ({
    ...story,
    title: cleanStoryText(story.title),
    summary: cleanStoryText(story.summary),
  }))
    .sort((a, b) =>
      ((b.score ?? 0) + (b.trustScore ?? 0) * .35 + (b.related ?? 1) * 4) -
      ((a.score ?? 0) + (a.trustScore ?? 0) * .35 + (a.related ?? 1) * 4)
    )
    .slice(0, 48);
  if (!stories.length) return NextResponse.json({ summary: "正在整理今天的 AI 核心趋势。" });
  const day = new Date().toISOString().slice(0, 10);
  const cacheKey = `v3:${day}:${stories.slice(0, 12).map((story) => story.title).join("|")}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 24 * 60 * 60_000) {
    return NextResponse.json({ summary: cached.summary, cached: true });
  }

  let summary = "";
  if (aiConfigured()) {
    const result = await generateJson<{ summary: string }>(
      "你是 AI Brief 的资深科技主编。只返回 JSON：{\"summary\":\"句1。句2。句3。\"}。必须恰好写3个完整中文句子，每句45至78个汉字。每句必须构成一个真正的行业趋势判断，结构为：正在发生的具体变化＋1至2个代表性公司、模型或产品事实＋这对行业、产品或开发者意味着什么。三个句子分别覆盖不同方向，优先选择会影响模型能力、成本、开发方式、商业落地或竞争格局的变化。必须使用输入中的具体事实，不得只写分类、来源数量、关注度或“发布了新产品”。不要出现媒体名称，不要写“资讯主要集中在”“持续释放信号”“市场关注度正在上升”“值得关注”等套话，不要把无关事件拼接。事实只有单一来源时使用审慎措辞。",
      JSON.stringify({ date: day, stories }),
    );
    const boilerplate = /资讯主要集中在|持续释放.*信号|市场关注度正在上升|值得关注的行业动态|等一手来源/;
    if (result?.summary && !boilerplate.test(result.summary) && (result.summary.match(/[。！？]/g)?.length ?? 0) >= 3) {
      summary = (result.summary.match(/[^。！？]+[。！？]/g) ?? []).slice(0, 3).join("").slice(0, 270);
    }
  }

  if (!summary) {
    const distinct = stories.filter((story, index, list) =>
      list.findIndex((item) => item.category === story.category) === index
    ).slice(0, 3);
    const impactFor = (category: string) => {
      if (category === "模型发布") return "模型能力、调用成本与开发选择将随之变化";
      if (category === "AI Agent") return "智能体正在从演示走向可执行的业务流程";
      if (category === "AI 编程") return "开发工具开始覆盖更多编码、测试与协作环节";
      if (category === "多模态") return "语音、图像与视频能力正更快进入实际产品";
      if (category === "学术研究") return "相关方法仍需更多复现与真实场景验证";
      if (category === "开源项目") return "开发者可用的模型与工具选择正在扩大";
      return "相关变化正在影响企业投入与产品落地节奏";
    };
    summary = distinct.map((story) => {
      const title = story.title.slice(0, 48);
      const fact = story.summary.match(/^[\s\S]*?[。！？.!?]/)?.[0]?.replace(/[。！？.!?]$/, "") ?? "";
      return `${title}${fact && !title.includes(fact) ? `，${fact}` : ""}；${impactFor(story.category)}${(story.related ?? 1) >= 3 ? "" : "，但仍需后续验证"}。`;
    }).join("");
  }

  summaryCache.set(cacheKey, { at: Date.now(), summary });
  while (summaryCache.size > 30) summaryCache.delete(summaryCache.keys().next().value ?? "");
  return NextResponse.json({ summary, cached: false });
}
