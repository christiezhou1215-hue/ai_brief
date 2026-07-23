type Json = Record<string, unknown>;

const config = () => ({
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseUrl: (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, ""),
  model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
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
