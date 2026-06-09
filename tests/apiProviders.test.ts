import { describe, expect, it } from "vitest";
import { createPolishRequest } from "../src/domain/apiProviders";

describe("createPolishRequest", () => {
  it("creates OpenAI-compatible requests for OpenAI, DeepSeek, and Doubao", () => {
    const openai = createPolishRequest({
      provider: "openai",
      apiKey: "secret",
      model: "gpt-4.1-mini",
      text: "原文",
    });
    const deepseek = createPolishRequest({
      provider: "deepseek",
      apiKey: "secret",
      model: "deepseek-chat",
      text: "原文",
    });
    const doubao = createPolishRequest({
      provider: "doubao",
      apiKey: "secret",
      model: "doubao-seed",
      text: "原文",
    });

    expect(openai.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(deepseek.url).toBe("https://api.deepseek.com/chat/completions");
    expect(doubao.url).toBe("https://ark.cn-beijing.volces.com/api/v3/chat/completions");
    expect(openai.headers.Authorization).toBe("Bearer secret");
    expect(JSON.parse(openai.body).messages[1].content).toContain("原文");
  });

  it("creates Gemini generateContent requests without persisting the key", () => {
    const request = createPolishRequest({
      provider: "gemini",
      apiKey: "gemini-secret",
      model: "gemini-2.5-flash",
      text: "原文",
    });

    expect(request.url).toContain("generativelanguage.googleapis.com");
    expect(request.url).toContain("key=gemini-secret");
    expect(request.headers.Authorization).toBeUndefined();
    expect(JSON.parse(request.body).contents[0].parts[0].text).toContain("原文");
  });
});
