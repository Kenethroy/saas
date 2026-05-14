import { apiClient } from "@/shared/api/client";

export async function getDashboardOverview(params = {}) {
  const response = await apiClient.get("/api/dashboard/overview", {
    params
  });

  return response.data;
}

export async function getDashboardReceivablesCalendar(params = {}) {
  const response = await apiClient.get("/api/dashboard/receivables-calendar", {
    params
  });

  return response.data;
}

export async function getDashboardNotifications() {
  const response = await apiClient.get("/api/dashboard/notifications");
  return response.data;
}
