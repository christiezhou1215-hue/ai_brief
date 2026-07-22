type Json = Record<string, unknown>;

const stripFence = (value: string) => value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");

const config = () => {
  const cloudflareToken = process.env.CLOUDFLARE_API_TOKEN;
  const cloudflareAccount = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (cloudflareToken && cloudflareAccount) return {
    apiKey: cloudflareToken,
    baseUrl: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccount}/ai/v1`,
    model: process.env.AI_MODEL || "@cf/qwen/qwen3-30b-a3b-fp8",
    provider: "Cloudflare Workers AI",
  };
  return {
    apiKey: process.env.AI_API_KEY || "",
    baseUrl: (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, ""),
    model: process.env.AI_MODEL || "gpt-4o-mini",
    provider: "OpenAI compatible",
  };
};

export const aiConfigured = () => Boolean(config().apiKey);
export const aiModel = () => config().model;

export async function generateJson<T extends Json>(system: string, input: string): Promise<T | null> {
  const { apiKey, baseUrl, model } = config();
  if (!apiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 28000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: input }],
      }),
    });
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content;
    return content ? JSON.parse(stripFence(content)) as T : null;
  } catch (error) {
    console.error("AI generation failed", error);
    return null;
  } finally { clearTimeout(timer); }
}
