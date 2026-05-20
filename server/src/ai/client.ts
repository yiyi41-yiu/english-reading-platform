import OpenAI from "openai";

let defaultClient: OpenAI | null = null;

function getDefaultClient(): OpenAI {
  if (!defaultClient) {
    defaultClient = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || "sk-placeholder",
      baseURL: "https://api.deepseek.com",
    });
  }
  return defaultClient;
}

const userClients = new Map<string, OpenAI>();

function resolveBaseURL(raw?: string): string {
  if (!raw || raw === "deepseek" || raw === "https://api.deepseek.com") return "https://api.deepseek.com";
  if (raw === "openai") return "https://api.openai.com/v1";
  return raw; // custom URL
}

export function getAIClient(apiKey?: string, baseURL?: string): OpenAI {
  if (!apiKey) return getDefaultClient();
  const resolvedBaseURL = resolveBaseURL(baseURL);
  const cacheKey = `${apiKey}:${resolvedBaseURL}`;
  if (!userClients.has(cacheKey)) {
    userClients.set(cacheKey, new OpenAI({ apiKey, baseURL: resolvedBaseURL }));
  }
  return userClients.get(cacheKey)!;
}

export async function chat(prompt: string, apiKey?: string, baseURL?: string): Promise<string> {
  const ai = getAIClient(apiKey, baseURL);
  const response = await ai.chat.completions.create({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: "You are an English reading assistant. Always respond with valid JSON only, no other text." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
    response_format: { type: "json_object" },
  });

  return response.choices[0]?.message?.content || "{}";
}
