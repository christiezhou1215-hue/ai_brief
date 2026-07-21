import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { aiConfigured, aiModel, generateJson } from "../../../lib/ai";

export const dynamic = "force-dynamic";

type Insight = { summary: string; trends: Array<{ title: string; reason: string }> };

type Story = { title: string; source: string; summary: string; level: string; publishedAt: string; score?: number };

const generateDailyInsight = unstable_cache(async (origin: string) => {
  const response = await fetch(`${origin}/api/news`, { next: { revalidate: 1800 } });
  if (!response.ok) throw new Error("资讯读取失败");
  const data = await response.json() as { items?: Story[] };
  const now = Date.now();
  const stories = (data.items ?? [])
    .filter((story) => now - new Date(story.publishedAt).getTime() <= 48 * 60 * 60 * 1000)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 20)
    .map(({ title, source, summary, level, publishedAt }) => ({ title, source, summary: summary.slice(0, 260), level, publishedAt }));
  if (!stories.length) throw new Error("缺少资讯");
  return generateJson<Insight>(
    "你是严谨的AI产业主编。基于多条当天资讯进行跨来源综合研判，而不是复述标题。只输出JSON：summary为120-180字中文洞察；trends为5项，每项包含title和reason。去除媒体口吻、来源名、营销话术和未经证实的推断。",
    JSON.stringify(stories),
  );
}, ["homepage-qwen-insight-v2"], { revalidate: 7200 });

export async function POST(request: Request) {
  if (!aiConfigured()) return NextResponse.json({ configured: false }, { status: 503 });
  const result = await generateDailyInsight(new URL(request.url).origin);
  if (!result?.summary || !Array.isArray(result.trends)) return NextResponse.json({ error: "模型生成失败" }, { status: 502 });
  return NextResponse.json({ ...result, configured: true, generatedBy: aiModel() }, { headers: { "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=3600" } });
}
