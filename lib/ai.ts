type Json = Record<string, unknown>;

const config = () => ({
  apiKey: process.env.AI_API_KEY || process.env.CLOUDFLARE_API_TOKEN || "",
  baseUrl: process.env.CLOUDFLARE_ACCOUNT_ID
    ? `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`
    : (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
  model: process.env.AI_MODEL || (process.env.CLOUDFLARE_ACCOUNT_ID ? "@cf/qwen/qwen3-30b-a3b-fp8" : "gpt-4o-mini"),
});

export const aiConfigured = () => Boolean(config().apiKey);
export const aiModel = () => config().model;

export async function generateJson<T extends Json>(system: string, input: string): Promise<T | null> {
  const { apiKey, baseUrl, model } = config();
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18_000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1400,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: input }],
      }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const raw = data.choices?.[0]?.message?.content?.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return raw ? JSON.parse(raw) as T : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}
