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
      "你是 AI Brief 的主编，底层模型是千问。综合给定的当天高价值资讯，输出准确、具体、有判断力的中文趋势总结。必须恰好写成3到4个完整句子，覆盖：最重要的变化、背后的共同趋势、对行业或用户的影响、仍需观察的不确定性。不要罗列标题，不要写空泛套话，不要提及自己是AI。只返回 JSON：{\"summary\":\"...\"}。",
      JSON.stringify({ date: day, stories }),
    );
    if (result?.summary && (result.summary.match(/[。！？]/g)?.length ?? 0) >= 3) summary = result.summary;
  }

  if (!summary) {
    const categories = [...new Set(stories.map((story) => story.category))].slice(0, 3);
    const top = stories[0];
    const verified = stories.filter((story) => (story.related ?? 1) >= 3).length;
    summary = `今天的 AI 动态主要集中在${categories.join("、")}。${top.source}等来源释放了新的产品与行业信号，模型能力正在更快进入真实工作流。${verified ? `其中有 ${verified} 个重要事件获得三个以上来源提及，显示市场关注正在集中。` : "多项变化仍处于早期披露阶段，实际效果需要结合后续数据判断。"}接下来值得关注的是使用成本、可靠性以及能否形成持续的业务价值。`;
  }

  summaryCache.set(cacheKey, { at: Date.now(), summary });
  while (summaryCache.size > 30) summaryCache.delete(summaryCache.keys().next().value ?? "");
  return NextResponse.json({ summary, cached: false });
}
