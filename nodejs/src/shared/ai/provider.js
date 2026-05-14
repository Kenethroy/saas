import { env } from "#config/env";
import { logger } from "#shared/logger/index";

function resolveEndpoint(baseUrl) {
  return `${String(baseUrl).replace(/\/+$/, "")}/chat/completions`;
}

async function parseJsonResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text } };
  }
}

export class AssistantAiProvider {
  isConfigured() {
    return Boolean(env.AI_PROVIDER && env.AI_PROVIDER !== "disabled" && env.AI_API_KEY && env.AI_MODEL);
  }

  getConfiguration() {
    return {
      provider: env.AI_PROVIDER,
      model: env.AI_MODEL
    };
  }

  async generateText({ messages }) {
    if (!this.isConfigured()) {
      return null;
    }

    const endpoint = resolveEndpoint(env.AI_BASE_URL);
    const controller = new AbortController();
    const timeoutMs = env.AI_CHAT_TIMEOUT_MS;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.AI_API_KEY}`
        },
        body: JSON.stringify({
          model: env.AI_MODEL,
          temperature: 0.2,
          messages
        }),
        signal: controller.signal
      });

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        const message = payload?.error?.message || `AI request failed with status ${response.status}`;
        throw new Error(message);
      }

      const text = payload?.choices?.[0]?.message?.content?.trim?.() ?? "";
      if (!text) {
        throw new Error("AI provider returned an empty response");
      }

      return {
        text,
        provider: env.AI_PROVIDER,
        model: env.AI_MODEL
      };
    } catch (error) {
      logger.warn({
        err: error,
        provider: env.AI_PROVIDER,
        model: env.AI_MODEL
      }, "Assistant AI generation failed; falling back to deterministic response");
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
