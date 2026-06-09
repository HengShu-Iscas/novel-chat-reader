import type { ApiProvider } from "./types";

export type PolishRequestInput = {
  provider: ApiProvider;
  apiKey: string;
  model: string;
  text: string;
};

export type PolishHttpRequest = {
  url: string;
  method: "POST";
  headers: Record<string, string>;
  body: string;
};

const SYSTEM_PROMPT =
  "把给定小说段落润色成自然的大模型回复文本。保留原意、人物、顺序和信息量，不新增剧情，不解释你的改写。";

export function createPolishRequest(input: PolishRequestInput): PolishHttpRequest {
  if (input.provider === "gemini") {
    return createGeminiRequest(input);
  }

  return createOpenAiCompatibleRequest(input);
}

function createOpenAiCompatibleRequest(input: PolishRequestInput): PolishHttpRequest {
  const urls: Record<Exclude<ApiProvider, "gemini">, string> = {
    openai: "https://api.openai.com/v1/chat/completions",
    deepseek: "https://api.deepseek.com/chat/completions",
    doubao: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
  };
  const provider = input.provider as Exclude<ApiProvider, "gemini">;

  return {
    url: urls[provider],
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: input.text },
      ],
    }),
  };
}

function createGeminiRequest(input: PolishRequestInput): PolishHttpRequest {
  const prompt = `${SYSTEM_PROMPT}\n\n${input.text}`;
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      input.model,
    )}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 },
    }),
  };
}
