import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";
import { cleanContentText, hasEncodingGarbage, isQualitySummary } from "../../../lib/content-quality";

type SummaryStory = {
  title: string; source: string; summary: string; category: string;
  related?: number; sourceMentions?: string[]; publishedAt?: string;
  score?: number; trustScore?: number;
};

const summaryCache = new Map<string, { at: number; summary: string }>();
const splitSentences = (value = "") =>
  (value.match(/[^。！？]+[。！？]/g) ?? []).map((sentence) => sentence.trim());
const invalidSummary = /资讯主要集中在|持续释放.*信号|市场关注度正在上升|值得关注的行业动态|等一手来源|^\s*\d+(?:\.\d+)?\s*(?:将|已|正|在|于)/;
const validConclusion = (sentence: string) =>
  sentence.length >= 38
  && sentence.length <= 110
  && !invalidSummary.test(sentence)
  && !/^(?:这|其|该|相关|部分|多家|一些)(?:一|些|项|类|领域|公司|模型)?/.test(sentence)
  && /因此|意味着|表明|显示|推动|加速|转向|进入|正在|开始|从.+走向|竞争|成本|能力|落地|格局/.test(sentence);
const cleanStoryText = (value = "", source = "") => cleanContentText(value, source);

async function createSummary(inputStories: SummaryStory[]) {
  const stories = inputStories.map((story) => ({
    ...story,
    title: cleanStoryText(story.title, story.source),
    summary: cleanStoryText(story.summary, story.source),
  }))
    .filter((story) =>
      !/早报|晚报|日报|周报|月报|盘点|合集|一文看懂/.test(story.title)
      && (story.summary.length >= 42 || (story.related ?? 1) >= 2)
      && cleanStoryText(story.summary) !== cleanStoryText(story.title)
      && !hasEncodingGarbage(`${story.title}${story.summary}`)
      && isQualitySummary(story.summary, 32)
    )
    .sort((a, b) =>
      ((b.score ?? 0) + (b.trustScore ?? 0) * .35 + (b.related ?? 1) * 4) -
      ((a.score ?? 0) + (a.trustScore ?? 0) * .35 + (a.related ?? 1) * 4)
    )
    .slice(0, 24);
  if (!stories.length) return { summary: "正在整理今天的 AI 核心趋势。", cached: false };
  const day = new Date().toISOString().slice(0, 10);
  const cacheKey = `v8:${day}:${stories.slice(0, 20).map((story) => story.title).join("|")}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 24 * 60 * 60_000) {
    return { summary: cached.summary, cached: true };
  }

  let summary = "";
  if (aiConfigured()) {
    const result = await generateJson<{ summary: string }>(
      "你是 AI Brief 的资深科技主编。读完当天材料后，先在内部按共同变化聚类，再给出三条编辑部结论；不要逐篇摘要新闻。只返回 JSON：{\"summary\":\"结论1。结论2。结论3。\"}。必须恰好3个完整中文句子，每句50至90个汉字。每条都要先说一个由至少两则相关材料共同反映的行业变化，再说明它对能力边界、成本结构、开发范式、商业落地或竞争格局意味着什么。公司、模型和产品仅作为论据嵌入，禁止写成发布清单。禁止照抄标题、罗列新闻、拼接无关事件、媒体名称、来源数量和关注度，禁止以数字或指代不清的词开头，禁止空泛套话。",
      JSON.stringify({ date: day, stories }),
    );
    const conclusions = splitSentences(result?.summary).slice(0, 3);
    if (conclusions.length === 3 && conclusions.every((sentence) =>
      validConclusion(sentence) && isQualitySummary(sentence, 38) && !hasEncodingGarbage(sentence)
    )) {
      summary = conclusions.join("").slice(0, 300);
    }
  }

  if (!summary) {
    summary = "今日高质量资讯仍在聚合，目前尚不足以形成三条有多项事实支撑的行业结论，请稍后刷新查看。";
  }

  if (splitSentences(summary).length === 3) {
    summaryCache.set(cacheKey, { at: Date.now(), summary });
    while (summaryCache.size > 30) summaryCache.delete(summaryCache.keys().next().value ?? "");
  }
  return { summary, cached: false };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { stories?: SummaryStory[] };
  return NextResponse.json(await createSummary(body.stories ?? []), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const response = await fetch(`${origin}/api/news`, {
    headers: { accept: "application/json" },
    next: { revalidate: 900 },
  });
  if (!response.ok) return NextResponse.json({ summary: "", error: "news unavailable" }, { status: 503 });
  const data = await response.json() as { items?: SummaryStory[] };
  const result = await createSummary(data.items ?? []);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=86400",
      "X-AI-Brief-Precomputed": "1",
    },
  });
}
