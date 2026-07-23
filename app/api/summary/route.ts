import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";

type SummaryStory = {
  title: string; source: string; summary: string; category: string;
  related?: number; sourceMentions?: string[]; publishedAt?: string;
};

const summaryCache = new Map<string, { at: number; summary: string }>();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { stories?: SummaryStory[] };
  const stories = (body.stories ?? []).slice(0, 36);
  if (!stories.length) return NextResponse.json({ summary: "正在整理今天的 AI 核心趋势。" });
  const day = new Date().toISOString().slice(0, 10);
  const cacheKey = `${day}:${stories.slice(0, 12).map((story) => story.title).join("|")}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 30 * 60_000) {
    return NextResponse.json({ summary: cached.summary, cached: true });
  }

  let summary = "";
  if (aiConfigured()) {
    const result = await generateJson<{ summary: string }>(
      "你是 AI Brief 的主编，底层模型是千问。综合给定的当天高价值资讯，输出准确、具体、易读的中文趋势总结。写2到3个完整短句，每句只表达一个判断，每句不超过45个汉字，总长度不超过150字。覆盖最重要的变化、共同趋势与值得继续观察的影响。不要堆砌标题、公司名或并列名词，不要写空泛套话，不要提及自己是AI。只返回 JSON：{\"summary\":\"...\"}。",
      JSON.stringify({ date: day, stories }),
    );
    if (result?.summary && (result.summary.match(/[。！？]/g)?.length ?? 0) >= 2) summary = result.summary.slice(0, 180);
  }

  if (!summary) {
    const categories = [...new Set(stories.map((story) => story.category))].slice(0, 3);
    const top = stories[0];
    const verified = stories.filter((story) => (story.related ?? 1) >= 3).length;
    summary = `今天的 AI 动态集中在${categories.slice(0, 2).join("与")}，新能力正加速进入真实工作流。${verified ? `${verified} 个重要事件获得多个来源提及，行业关注正在集中。` : `${top.source}等来源披露了新进展，但实际效果仍需后续验证。`}接下来应关注使用成本、可靠性与持续业务价值。`;
  }

  summaryCache.set(cacheKey, { at: Date.now(), summary });
  while (summaryCache.size > 30) summaryCache.delete(summaryCache.keys().next().value ?? "");
  return NextResponse.json({ summary, cached: false });
}
