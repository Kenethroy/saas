import { apiClient } from "@/shared/api/client";

export async function queryAssistant(payload) {
  const response = await apiClient.post("/api/assistant/query", payload);
  return response.data;
}

export async function getAssistantStatus() {
  const response = await apiClient.get("/api/assistant/status");
  return response.data;
}

export async function reindexAssistant(payload = {}) {
  const response = await apiClient.post("/api/assistant/reindex", payload);
  return response.data;
}
