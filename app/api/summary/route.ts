import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";
import { cleanContentText, hasBrokenFactFragment, hasEncodingGarbage, isQualitySummary } from "../../../lib/content-quality";

type SummaryStory = {
  title: string; source: string; summary: string; category: string;
  related?: number; sourceMentions?: string[]; publishedAt?: string;
  score?: number; trustScore?: number; entities?: string[]; eventKey?: string;
};

const summaryCache = new Map<string, { at: number; summary: string }>();
const splitSentences = (value = "") =>
  (value.match(/[^。！？]+[。！？]/g) ?? []).map((sentence) => sentence.trim());
const invalidSummary = /资讯主要集中在|持续释放.*信号|市场关注度正在上升|值得关注的行业动态|等一手来源|全球.*共识显著增强|均指向|企业需同步投入|^\s*\d+(?:\.\d+)?\s*(?:将|已|正|在|于)/;
const validConclusion = (sentence: string) =>
  sentence.length >= 42
  && sentence.length <= 100
  && !invalidSummary.test(sentence)
  && !hasBrokenFactFragment(sentence)
  && !/[\/｜]|(?:Sohu|QQ News|新华网|光明网|人民网|爱范儿|品玩)/i.test(sentence)
  && !/^(?:这|其|该|相关|部分|多家|一些)(?:一|些|项|类|领域|公司|模型)?/.test(sentence)
  && /意味着|表明|显示|推动|加速|转向|进入|正在|开始|从.+走向|竞争|成本|能力|落地|格局|门槛|重心/.test(sentence);
const cleanStoryText = (value = "", source = "") => cleanContentText(value, source);
type DraftConclusion = { trend: string; implication: string; evidenceIds: string[] };

const meaningfulTokens = (value = "") => {
  const latin = value.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g)?.map((token) => token.toLowerCase()) ?? [];
  const chinese = value.match(/[\u4e00-\u9fff]{2,8}/g) ?? [];
  return new Set([...latin, ...chinese.filter((token) => !/^(今天|目前|相关|行业|公司|模型|产品|技术|市场|能力|发布|推出)$/.test(token))]);
};

const evidenceIsRelated = (
  ids: string[],
  stories: Array<SummaryStory & { id: string }>,
) => {
  const evidence = [...new Set(ids)].map((id) => stories.find((story) => story.id === id)).filter(Boolean) as Array<SummaryStory & { id: string }>;
  if (evidence.length < 2) return false;
  for (let left = 0; left < evidence.length; left += 1) {
    for (let right = left + 1; right < evidence.length; right += 1) {
      const leftEntities = new Set((evidence[left].entities ?? []).map((item) => item.toLowerCase()));
      const sharedEntity = (evidence[right].entities ?? []).some((item) => leftEntities.has(item.toLowerCase()));
      const leftTokens = meaningfulTokens(`${evidence[left].title} ${evidence[left].summary}`);
      const sharedTokens = [...meaningfulTokens(`${evidence[right].title} ${evidence[right].summary}`)]
        .filter((token) => leftTokens.has(token));
      if (sharedEntity || sharedTokens.length >= 1 || (evidence[left].eventKey && evidence[left].eventKey === evidence[right].eventKey)) return true;
    }
  }
  return false;
};

const composeConclusion = (item: DraftConclusion) => {
  const trend = cleanStoryText(item.trend).replace(/[，。！？；：\s]+$/, "");
  const implication = cleanStoryText(item.implication).replace(/[，。！？；：\s]+$/, "");
  return `${trend}，${implication}。`;
};

const conclusionIsValid = (item: DraftConclusion, stories: Array<SummaryStory & { id: string }>) => {
  const text = composeConclusion(item);
  return item.trend.length >= 18
    && item.implication.length >= 16
    && evidenceIsRelated(item.evidenceIds ?? [], stories)
    && validConclusion(text)
    && splitSentences(text).length === 1
    && isQualitySummary(text, 42)
    && !hasEncodingGarbage(text);
};

async function createSummary(inputStories: SummaryStory[]) {
  const stories = inputStories.map((story, index) => ({
    ...story,
    id: `S${index + 1}`,
    title: cleanStoryText(story.title, story.source),
    summary: cleanStoryText(story.summary, story.source),
  }))
    .filter((story) =>
      !/早报|晚报|日报|周报|月报|盘点|合集|一文看懂/.test(story.title)
      && (story.summary.length >= 42 || (story.related ?? 1) >= 2)
      && cleanStoryText(story.summary) !== cleanStoryText(story.title)
      && !hasEncodingGarbage(`${story.title}${story.summary}`)
      && !hasBrokenFactFragment(`${story.title}。${story.summary}`)
      && isQualitySummary(story.summary, 32)
    )
    .sort((a, b) =>
      ((b.score ?? 0) + (b.trustScore ?? 0) * .35 + (b.related ?? 1) * 4) -
      ((a.score ?? 0) + (a.trustScore ?? 0) * .35 + (a.related ?? 1) * 4)
    )
    .slice(0, 24);
  if (!stories.length) return { summary: "正在整理今天的 AI 核心趋势。", cached: false };
  const day = new Date().toISOString().slice(0, 10);
  const cacheKey = `v9:${day}:${stories.slice(0, 20).map((story) => story.title).join("|")}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 24 * 60 * 60_000) {
    return { summary: cached.summary, cached: true };
  }

  let summary = "";
  if (aiConfigured()) {
    const result = await generateJson<{ conclusions: DraftConclusion[] }>(
      `你是 AI Brief 的资深科技主编。任务不是排列新闻，而是从当天材料中提炼三条有用、准确的行业判断。
只返回 JSON：{"conclusions":[{"trend":"多条材料共同反映的具体变化","implication":"这项变化带来的实际含义","evidenceIds":["S1","S2"]}]}。
规则：
1. 必须恰好三条；trend 与 implication 都必须主语明确、信息完整，组合后为42至100个汉字的自然中文句子。
2. 每条必须由至少两则内容相关的材料共同支持，并填写真实 evidenceIds；不允许把无关事件强行拼成趋势。
3. 先概括共同变化，再说明它对模型能力、成本、开发方式、商业落地或竞争格局的实际含义。
4. 公司、模型、数字只作为证据，不得照抄或串联标题，不得写成新闻清单。
5. 禁止媒体名称、来源数量、关注度、空泛口号、政治立场推断和超出材料的因果判断。
6. 禁止残缺编号、斜杠、来源尾缀、乱码、指代不明和截断的产品或模型名称。若材料不足，宁可输出更审慎的具体判断，也不得编造。`,
      JSON.stringify({ date: day, stories }),
    );
    const conclusions = Array.isArray(result?.conclusions) ? result.conclusions.slice(0, 3) : [];
    if (conclusions.length === 3 && conclusions.every((item) => conclusionIsValid(item, stories))) {
      const edited = await generateJson<{ conclusions: DraftConclusion[] }>(
        `你是科技媒体终审编辑。校对三条行业结论，只能依据给定材料和原证据 ID 修改表达。
只返回 JSON：{"conclusions":[{"trend":"完整趋势判断","implication":"具体行业含义","evidenceIds":["S1","S2"]}]}。
必须保留三条及各自证据 ID；删除病句、歧义、残缺数字、截断名称、媒体尾缀、口号和无依据的因果推断。不得增加材料中没有的事实，也不得把不同主题合并。`,
        JSON.stringify({ date: day, draft: conclusions, stories }),
      );
      const finalConclusions = Array.isArray(edited?.conclusions) ? edited.conclusions.slice(0, 3) : [];
      const accepted = finalConclusions.length === 3 && finalConclusions.every((item) => conclusionIsValid(item, stories))
        ? finalConclusions
        : conclusions;
      summary = accepted.map(composeConclusion).join("").slice(0, 320);
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
