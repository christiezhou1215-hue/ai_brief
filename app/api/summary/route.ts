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
  const cacheKey = `v2:${day}:${stories.slice(0, 12).map((story) => story.title).join("|")}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 24 * 60 * 60_000) {
    return NextResponse.json({ summary: cached.summary, cached: true });
  }

  let summary = "";
  if (aiConfigured()) {
    const result = await generateJson<{ summary: string }>(
      "你是 AI Brief 的资深科技主编。只返回 JSON：{\"summary\":\"句1。句2。句3。\"}。必须恰好写3个完整中文句子，每句30至58个汉字，每句只总结一个不同的核心趋势，并写清楚具体主体、发生的动作以及对产品、开发者或行业的实际影响。优先采用高分、多来源提及和官方一手信息；只有单一来源时使用审慎措辞。不要把无关事件拼进同一句，不要复述长标题，不要罗列媒体名，不要使用“动态集中在”“持续释放信号”“值得关注”等空泛套话。信息不足时明确写“仍需后续验证”。",
      JSON.stringify({ date: day, stories }),
    );
    if (result?.summary && (result.summary.match(/[。！？]/g)?.length ?? 0) >= 3) {
      summary = (result.summary.match(/[^。！？]+[。！？]/g) ?? []).slice(0, 3).join("").slice(0, 210);
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
      const title = story.title.slice(0, 42);
      return `${title}，${impactFor(story.category)}${(story.related ?? 1) >= 3 ? "" : "，但仍需后续验证"}。`;
    }).join("");
  }

  summaryCache.set(cacheKey, { at: Date.now(), summary });
  while (summaryCache.size > 30) summaryCache.delete(summaryCache.keys().next().value ?? "");
  return NextResponse.json({ summary, cached: false });
}
