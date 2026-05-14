import { apiClient } from "@/shared/api/client";

export async function getSettings() {
  const response = await apiClient.get("/api/settings");
  return response.data.data;
}

export async function saveSettings(payload) {
  const response = await apiClient.post("/api/settings", { payload });
  return response.data;
}

export async function getPublicSettings() {
  const response = await apiClient.get("/api/settings/public");
  return response.data.data;
}

export async function changePassword(payload) {
  const response = await apiClient.post("/api/settings/change-password", payload);
  return response.data;
}

export async function updateLogo(formData) {
  const response = await apiClient.post("/api/settings/logo", formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
}
