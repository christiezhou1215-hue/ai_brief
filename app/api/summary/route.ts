import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";

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
  const cacheKey = `v4:${day}:${stories.slice(0, 16).map((story) => story.title).join("|")}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 24 * 60 * 60_000) {
    return NextResponse.json({ summary: cached.summary, cached: true });
  }

  let summary = "";
  if (aiConfigured()) {
    const result = await generateJson<{ summary: string }>(
      "你是 AI Brief 的资深科技主编。先在内部把当天资讯按同一议题聚类，再归纳三条编辑部结论；不要逐条复述新闻。只返回 JSON：{\"summary\":\"结论1。结论2。结论3。\"}。必须恰好写3个完整中文句子，每句45至85个汉字。每条结论必须综合至少2条相互关联的资讯，并包含：明确的行业变化、具体公司/模型/产品证据，以及这个变化对竞争格局、成本、开发方式或商业落地的意义。句首必须出现明确主体或明确行业领域，禁止以数字、代词、“部分”“多家”开头，禁止省略模型名称。不要罗列三条新闻，不要照抄标题，不要拼接无关事件，不要使用媒体名称、来源数量和关注度。禁止“资讯主要集中在”“持续释放信号”“市场关注度正在上升”“值得关注”等空泛表述。若某个议题不足2条相关资讯，不要把它写成结论。",
      JSON.stringify({ date: day, stories }),
    );
    const conclusions = splitSentences(result?.summary).slice(0, 3);
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
