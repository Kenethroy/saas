import { apiClient } from "@/shared/api/client";

export async function getCurrentUser() {
  const response = await apiClient.get("/api/auth/me");
  return response.data;
}

export async function logoutCurrentUser() {
  const response = await apiClient.post("/api/auth/logout");
  return response.data;
}

export async function getCurrentUserSessions() {
  const response = await apiClient.get("/api/auth/sessions");
  return response.data;
}

export async function logoutOtherSessions() {
  const response = await apiClient.post("/api/auth/logout-others");
  return response.data;
}
