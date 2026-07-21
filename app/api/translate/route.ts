import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const chunkText = (text: string) => {
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length) {
    if (remaining.length <= 420) { chunks.push(remaining); break; }
    const window = remaining.slice(0, 420);
    const boundary = Math.max(window.lastIndexOf("。"), window.lastIndexOf("！"), window.lastIndexOf("？"), window.lastIndexOf(". "), window.lastIndexOf("! "), window.lastIndexOf("? "), window.lastIndexOf("\n"));
    const end = boundary > 180 ? boundary + 1 : 420;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end).trimStart();
  }
  return chunks;
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as { text?: string; direction?: "zh-en" | "en-zh" };
    const text = body.text?.trim() ?? "";
    if (!text) return NextResponse.json({ error: "请输入需要翻译的内容" }, { status: 400 });
    if (text.length > 2000) return NextResponse.json({ error: "单次翻译最多支持 2000 个字符" }, { status: 400 });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const translatedParts: string[] = [];
      for (const part of chunkText(text)) {
        const endpoint = new URL("https://translate.googleapis.com/translate_a/single");
        endpoint.searchParams.set("client", "gtx"); endpoint.searchParams.set("sl", body.direction === "en-zh" ? "en" : "zh-CN"); endpoint.searchParams.set("tl", body.direction === "en-zh" ? "zh-CN" : "en"); endpoint.searchParams.set("dt", "t"); endpoint.searchParams.set("q", part);
        const response = await fetch(endpoint, { signal: controller.signal, headers: { accept: "application/json", "user-agent": "AI-Brief/1.0" } });
        if (!response.ok) throw new Error(`translation failed: ${response.status}`);
        const data = await response.json() as Array<Array<Array<string | null>>>;
        const translatedPart = data[0]?.map((segment) => segment[0] ?? "").join("").trim();
        if (!translatedPart) throw new Error("translation failed: empty result");
        translatedParts.push(translatedPart);
      }
      const translatedText = translatedParts.join(" ");
      return NextResponse.json({ translatedText, direction: body.direction === "en-zh" ? "en-zh" : "zh-en", translatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
    } finally { clearTimeout(timer); }
  } catch { return NextResponse.json({ error: "翻译服务暂时不可用，请稍后重试" }, { status: 502 }); }
}
