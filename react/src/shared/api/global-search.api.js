import { apiClient } from "@/shared/api/client";

export async function getGlobalSearchResults(params = {}) {
  const response = await apiClient.get("/api/search/global", { params });
  return response.data;
}
