import { NextResponse } from "next/server";
import { aiConfigured, generateJson } from "../../../lib/ai";

type TranslateItem = { id: string; title: string; summary: string };
const translationCache = new Map<string, Omit<TranslateItem, "id">>();
const cacheKey = (item: TranslateItem, target: "zh" | "en") => `${target}:${item.title}\n${item.summary}`;

async function googleTranslate(item: TranslateItem, target: "zh" | "en") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const text = `${item.title}\n${item.summary}`;
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`, { signal: controller.signal });
    if (!response.ok) throw new Error("translation failed");
    const data = await response.json() as Array<Array<Array<string>>>;
    const translated = (data[0] ?? []).map((part) => part[0]).join("");
    const [title, ...summary] = translated.split("\n");
    return { id: item.id, title: title || item.title, summary: summary.join("\n") || item.summary };
  } catch {
    return { ...item };
  } finally { clearTimeout(timer); }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    title?: string; summary?: string; target?: "zh" | "en"; items?: TranslateItem[];
  };
  if (!body.target) return NextResponse.json({ error: "缺少目标语言" }, { status: 400 });
  const items = (body.items?.length ? body.items : body.title ? [{ id: "single", title: body.title, summary: body.summary ?? "" }] : [])
    .filter((item) => item.title).slice(0, 20);
  if (!items.length) return NextResponse.json({ error: "缺少翻译内容" }, { status: 400 });
  const resolved = new Map<string, TranslateItem>();
  items.forEach((item) => {
    const cached = translationCache.get(cacheKey(item, body.target!));
    if (cached) resolved.set(item.id, { id: item.id, ...cached });
  });
  const missing = items.filter((item) => !resolved.has(item.id));

  if (missing.length && aiConfigured()) {
    const result = await generateJson<{ translations: TranslateItem[] }>(
      `你是专业科技新闻译者。将每条内容完整翻译为${body.target === "zh" ? "简体中文" : "自然、专业的英文"}。保留 id，保留公司、产品、模型和数字等专有信息。每个 title 和 summary 都必须翻译，不得省略。只返回 JSON：{"translations":[{"id":"...","title":"...","summary":"..."}]}。`,
      JSON.stringify({ items: missing }),
    );
    const valid = result?.translations?.filter((item) => item.id && item.title);
    valid?.forEach((item) => resolved.set(item.id, item));
  }

  const stillMissing = missing.filter((item) => !resolved.has(item.id));
  const fallback = await Promise.all(stillMissing.map((item) => googleTranslate(item, body.target!)));
  fallback.forEach((item) => resolved.set(item.id, item));
  const translations = items.map((item) => resolved.get(item.id) ?? item);
  translations.forEach((item) => translationCache.set(cacheKey(items.find((source) => source.id === item.id) ?? item, body.target!), { title: item.title, summary: item.summary }));
  while (translationCache.size > 600) translationCache.delete(translationCache.keys().next().value ?? "");
  if (body.items?.length) return NextResponse.json({ translations, target: body.target });
  return NextResponse.json({ ...translations[0], target: body.target });
}
