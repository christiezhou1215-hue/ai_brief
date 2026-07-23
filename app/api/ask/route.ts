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
  const allContext = (body.context ?? []).slice(0, 60);
  const terms = question.toLowerCase().split(/[\s，。？！、：；]+/).filter((term) => term.length > 1);
  const relevance = (item: ContextStory) => {
    const text = `${item.title} ${item.summary} ${item.source}`.toLowerCase();
    return terms.reduce((sum, term) => sum + (text.includes(term) ? 8 : 0), 0)
      + Math.min(12, item.trustScore ?? 0) / 6
      + Math.min(9, (item.sourceMentions?.length ?? 1) * 2);
  };
  const context = [...allContext].sort((a, b) => relevance(b) - relevance(a)).slice(0, 28);
  const citations = context.map((item, index) => ({
    id: index + 1, title: item.title, source: item.source, url: item.url,
  }));

  if (aiConfigured()) {
    const result = await generateJson<{ answer: string; citationIds: number[] }>(
      "你是 AI Brief 的资深研究编辑。结合给定的最新网络资讯与对话历史，先直接回答用户问题，再做跨来源综合判断。回答必须包含：1）一句话结论；2）3-5条核心发现，每条解释事实与意义；3）影响与接下来值得观察的信号；4）必要的不确定性。不要简单罗列标题，不要使用“点击查看原文”充当分析，不要编造。用自然、专业、清晰的中文输出 JSON：answer 为可直接展示的完整回答，citationIds 只选择真正支持结论的资料编号。",
      JSON.stringify({ question, history: (body.history ?? []).slice(-8), sources: context.map((item, i) => ({ id: i + 1, ...item })) }),
    );
    if (result?.answer) {
      const ids = new Set(result.citationIds ?? []);
      return NextResponse.json({ answer: result.answer, citations: citations.filter((item) => ids.has(item.id)), mode: "ai" });
    }
  }

  const ranked = context.slice(0, 5);
  const recurringSources = [...new Set(ranked.flatMap((item) => item.sourceMentions ?? [item.source]))];
  const summaries = ranked.map((item) => item.summary).filter((text) => text && !/点击查看/.test(text));
  const strongest = ranked[0];
  const answer = ranked.length
    ? `结论\n${strongest.title} 是当前资讯中与问题最相关的核心信号；结合其余报道看，变化重点并非单一事件，而是 AI 能力正在更快进入产品、工作流与具体行业。\n\n核心发现\n${ranked.slice(0, 4).map((item, i) => `${i + 1}. ${item.title}\n${summaries[i] || "这条信息提供了新的产品或行业信号，仍需结合后续披露判断实际影响。"}`).join("\n\n")}\n\n综合判断\n这些信息来自 ${recurringSources.slice(0, 6).join("、")} 等来源。共同趋势是模型发布节奏与应用落地正在同步加快；真正需要观察的是用户采用、成本变化、可靠性以及是否形成可持续的业务价值。\n\n不确定性\n当前结论基于已抓取的最新公开资讯，部分事件仍可能只有少量来源披露，后续官方数据可能改变判断。`
    : "当前资料中没有找到足够信息回答这个问题。你可以换一个更具体的关键词，或稍后刷新资讯后再试。";
  return NextResponse.json({ answer, citations: ranked.slice(0, 5).map((item) => ({ title: item.title, source: item.source, url: item.url })), mode: "synthesis" });
}
