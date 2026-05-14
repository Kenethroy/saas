import { env } from "#config/env";
import { logger } from "#shared/logger/index";

function resolveEndpoint(baseUrl) {
  return `${String(baseUrl).replace(/\/+$/, "")}/embeddings`;
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

export class AssistantEmbeddingProvider {
  isConfigured() {
    return Boolean(env.AI_PROVIDER && env.AI_PROVIDER !== "disabled" && env.AI_API_KEY && env.AI_EMBEDDING_MODEL);
  }

  getConfiguration() {
    return {
      provider: env.AI_PROVIDER,
      model: env.AI_EMBEDDING_MODEL
    };
  }

  async embedTexts(texts = []) {
    if (!this.isConfigured() || texts.length === 0) {
      return null;
    }

    const endpoint = resolveEndpoint(env.AI_BASE_URL);
    const controller = new AbortController();
    const timeoutMs = 20000; // Embeddings can be slow for large batches
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.AI_API_KEY}`
        },
        body: JSON.stringify({
          model: env.AI_EMBEDDING_MODEL,
          input: texts
        }),
        signal: controller.signal
      });

      const payload = await parseJsonResponse(response);

      if (!response.ok) {
        const message = payload?.error?.message || `Embedding request failed with status ${response.status}`;
        throw new Error(message);
      }

      const embeddings = payload?.data?.map((entry) => entry.embedding) ?? [];
      if (embeddings.length === 0) {
        throw new Error("AI provider returned no embeddings");
      }

      return embeddings;
    } catch (error) {
      logger.warn({
        err: error,
        provider: env.AI_PROVIDER,
        model: env.AI_EMBEDDING_MODEL
      }, "Assistant embedding generation failed");
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
