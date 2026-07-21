import { NextResponse } from "next/server";
import { aiConfigured, aiModel, generateJson } from "../../../lib/ai";

export const dynamic = "force-dynamic";

type Insight = { summary: string; trends: Array<{ title: string; reason: string }> };

export async function POST(request: Request) {
  const body = await request.json() as { stories?: Array<{ title: string; source: string; summary: string; level: string; publishedAt: string }> };
  const stories = (body.stories ?? []).slice(0, 35);
  if (!stories.length) return NextResponse.json({ error: "缺少资讯" }, { status: 400 });
  if (!aiConfigured()) return NextResponse.json({ configured: false }, { status: 503 });
  const result = await generateJson<Insight>(
    "你是严谨的AI产业主编。基于多条当天资讯进行跨来源综合研判，而不是复述标题。只输出JSON：summary为120-180字中文洞察；trends为5项，每项包含title和reason。去除媒体口吻、来源名、营销话术和未经证实的推断。",
    JSON.stringify(stories),
  );
  if (!result?.summary || !Array.isArray(result.trends)) return NextResponse.json({ error: "模型生成失败" }, { status: 502 });
  return NextResponse.json({ ...result, configured: true, generatedBy: aiModel() }, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
}
