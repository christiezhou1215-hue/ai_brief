import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";

type ContextStory = {
  title: string; source: string; summary: string; url: string; publishedAt: string;
  trustScore?: number; sourceMentions?: string[];
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    question?: string;
    history?: Array<{ role: string; content: string }>;
    context?: ContextStory[];
  };
  const question = body.question?.trim() ?? "";
  if (!question) return NextResponse.json({ error: "请输入问题" }, { status: 400 });
  const context = (body.context ?? []).slice(0, 24);
  const citations = context.slice(0, 6).map((item, index) => ({
    id: index + 1, title: item.title, source: item.source, url: item.url,
  }));

  if (aiConfigured()) {
    const result = await generateJson<{ answer: string; citationIds: number[] }>(
      "你是 AI Brief 的研究助理。只能依据给定的当前资讯和对话历史回答；明确区分事实与推断，保留时间、数字与限制。用简洁中文输出 JSON：answer 为结构清晰的回答，citationIds 为真正支持回答的资料编号。资料不足时直接说明，不要编造。",
      JSON.stringify({ question, history: (body.history ?? []).slice(-8), sources: context.map((item, i) => ({ id: i + 1, ...item })) }),
    );
    if (result?.answer) {
      const ids = new Set(result.citationIds ?? []);
      return NextResponse.json({ answer: result.answer, citations: citations.filter((item) => ids.has(item.id)), mode: "ai" });
    }
  }

  const terms = question.toLowerCase().split(/[\s，。？！、]+/).filter((term) => term.length > 1);
  const ranked = [...context].sort((a, b) => {
    const score = (item: ContextStory) => terms.reduce((sum, term) => sum + (`${item.title} ${item.summary}`.toLowerCase().includes(term) ? 1 : 0), 0);
    return score(b) - score(a);
  }).slice(0, 4);
  const answer = ranked.length
    ? `根据当前已聚合的资讯，与你的问题最相关的是：\n\n${ranked.map((item, i) => `${i + 1}. ${item.title}：${item.summary}`).join("\n\n")}\n\n以上是基于当前资讯的快速检索结果；配置 AI 模型后可获得跨来源综合研判。`
    : "当前资料中没有找到足够信息回答这个问题。你可以换一个更具体的关键词，或稍后刷新资讯后再试。";
  return NextResponse.json({ answer, citations: citations.slice(0, 4), mode: "search" });
}
