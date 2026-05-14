import { apiClient } from "@/shared/api/client";

export async function getActivityLogs(params = {}) {
  const response = await apiClient.get("/api/activity/logs", { params });
  return response.data;
}
