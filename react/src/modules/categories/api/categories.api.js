import { apiClient } from "@/shared/api/client";

export async function getCategories(params = {}) {
  const response = await apiClient.get("/api/categories", {
    params
  });

  return response.data;
}

export async function getCategoryOptions() {
  const response = await apiClient.get("/api/categories/options");
  return response.data;
}

export async function createCategory(payload) {
  const response = await apiClient.post("/api/categories/create", payload);
  return response.data;
}

export async function updateCategory(categoryId, payload) {
  const response = await apiClient.patch(`/api/categories/${categoryId}`, payload);
  return response.data;
}

export async function deleteCategory(categoryId) {
  const response = await apiClient.delete(`/api/categories/${categoryId}`);
  return response.data;
}
