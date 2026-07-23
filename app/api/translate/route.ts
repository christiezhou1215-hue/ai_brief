import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { title?: string; summary?: string; target?: "zh" | "en" };
  if (!body.title || !body.target) return NextResponse.json({ error: "缺少翻译内容" }, { status: 400 });
  if (aiConfigured()) {
    const result = await generateJson<{ title: string; summary: string }>(
      `你是专业科技新闻译者。将内容翻译为${body.target === "zh" ? "简体中文" : "自然、专业的英文"}，保留公司、产品和模型专有名词。只返回 JSON。`,
      JSON.stringify({ title: body.title, summary: body.summary ?? "" }),
    );
    if (result?.title) return NextResponse.json({ ...result, target: body.target });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const text = `${body.title}\n${body.summary ?? ""}`;
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${body.target}&dt=t&q=${encodeURIComponent(text)}`, { signal: controller.signal });
    if (response.ok) {
      const data = await response.json() as Array<Array<Array<string>>>;
      const translated = (data[0] ?? []).map((part) => part[0]).join("");
      const [title, ...summary] = translated.split("\n");
      if (title) return NextResponse.json({ title, summary: summary.join("\n") || body.summary || "", target: body.target });
    }
  } catch { /* retain original content below */ }
  finally { clearTimeout(timer); }
  return NextResponse.json({
    title: body.title,
    summary: body.summary || (body.target === "zh" ? "暂无可翻译摘要。" : "No summary is available."),
    target: body.target,
    fallback: true,
  });
}
