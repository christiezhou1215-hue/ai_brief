import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";

type SummaryStory = {
  title: string; source: string; summary: string; category: string;
  related?: number; sourceMentions?: string[]; publishedAt?: string;
  score?: number; trustScore?: number;
};
type EditorialTrend = { conclusion: string; evidenceTitles: string[] };

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
    .filter((story) =>
      !/早报|晚报|日报|周报|月报|盘点|合集|一文看懂/.test(story.title)
      && (story.summary.length >= 42 || (story.related ?? 1) >= 2)
      && cleanStoryText(story.summary) !== cleanStoryText(story.title)
    )
    .sort((a, b) =>
      ((b.score ?? 0) + (b.trustScore ?? 0) * .35 + (b.related ?? 1) * 4) -
      ((a.score ?? 0) + (a.trustScore ?? 0) * .35 + (a.related ?? 1) * 4)
    )
    .slice(0, 48);
  if (!stories.length) return NextResponse.json({ summary: "正在整理今天的 AI 核心趋势。" });
  const day = new Date().toISOString().slice(0, 10);
  const cacheKey = `v5:${day}:${stories.slice(0, 20).map((story) => story.title).join("|")}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 24 * 60 * 60_000) {
    return NextResponse.json({ summary: cached.summary, cached: true });
  }

  let summary = "";
  if (aiConfigured()) {
    const result = await generateJson<{ trends: EditorialTrend[] }>(
      "你是 AI Brief 的资深科技主编。你的任务不是摘要新闻，而是读完当天材料后给出编辑部判断。先按同一变化聚类，只保留至少有2条材料共同支持的主题，再输出3条彼此不同的结论。只返回 JSON：{\"trends\":[{\"conclusion\":\"完整结论。\",\"evidenceTitles\":[\"输入中的完整标题1\",\"输入中的完整标题2\"]}]}。每条 conclusion 为55至90个汉字，结构必须是：先说正在形成的行业变化，再解释它意味着什么；公司、模型和产品只能作为论据嵌入句中，不能把句子写成发布清单。evidenceTitles 必须逐字复制输入标题且至少2个，用于证明结论确实来自多条材料。禁止照抄标题、禁止逐条排列新闻、禁止拼接无关事件、禁止媒体名称和来源数量，禁止以数字或指代不清的词开头。优先判断能力边界、成本结构、开发范式、商业落地和竞争格局发生了什么变化。",
      JSON.stringify({ date: day, stories }),
    );
    const titleSet = new Set(stories.map((story) => story.title));
    const trends = (result?.trends ?? []).filter((trend) =>
      Array.isArray(trend.evidenceTitles)
      && new Set(trend.evidenceTitles.filter((title) => titleSet.has(cleanStoryText(title)))).size >= 2
      && validConclusion(trend.conclusion)
    ).slice(0, 3);
    const conclusions = trends.map((trend) => splitSentences(trend.conclusion)[0] ?? "");
    if (conclusions.length === 3 && conclusions.every(validConclusion)) {
      summary = conclusions.join("").slice(0, 300);
    }
  }

  if (!summary) {
    const grouped = [...new Map(stories.map((story) => [story.category, [] as SummaryStory[]])).entries()]
      .map(([category]) => ({ category, items: stories.filter((story) => story.category === category) }))
      .filter((group) => group.items.length >= 2)
      .slice(0, 3);
    const impactFor = (category: string) => {
      if (category === "模型发布") return "模型能力、调用成本与开发选择将随之变化";
      if (category === "AI Agent") return "智能体正在从演示走向可执行的业务流程";
      if (category === "AI 编程") return "开发工具开始覆盖更多编码、测试与协作环节";
      if (category === "多模态") return "语音、图像与视频能力正更快进入实际产品";
      if (category === "学术研究") return "相关方法仍需更多复现与真实场景验证";
      if (category === "开源项目") return "开发者可用的模型与工具选择正在扩大";
      return "相关变化正在影响企业投入与产品落地节奏";
    };
    summary = grouped.map(({ category, items }) => {
      const subjects = items.slice(0, 2).map((story) => story.title.replace(/[：:｜|].*$/, "").slice(0, 22));
      return `${category}领域的多项进展显示，${subjects.join("与")}正在形成同向变化，${impactFor(category)}。`;
    }).join("");
    if (splitSentences(summary).length < 3) {
      summary = "今日资讯仍在形成可交叉验证的主题，目前不足以得出三条可靠的行业结论，请稍后刷新查看。";
    }
  }

  summaryCache.set(cacheKey, { at: Date.now(), summary });
  while (summaryCache.size > 30) summaryCache.delete(summaryCache.keys().next().value ?? "");
  return NextResponse.json({ summary, cached: false });
}
