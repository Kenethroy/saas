import { apiClient } from "@/shared/api/client";

export async function getExpenseCategories() {
  const response = await apiClient.get("/api/business-expenses/categories");
  return response.data;
}

export async function getBusinessExpenseSummary() {
  const response = await apiClient.get("/api/business-expenses/summary");
  return response.data;
}

export async function getBusinessExpenses(params = {}) {
  const response = await apiClient.get("/api/business-expenses", {
    params
  });
  return response.data;
}

export async function createBusinessExpense(payload) {
  const response = await apiClient.post("/api/business-expenses/create", payload);
  return response.data;
}

export async function updateBusinessExpense(id, payload) {
  const response = await apiClient.patch(`/api/business-expenses/${id}`, payload);
  return response.data;
}

export async function deleteBusinessExpense(id) {
  const response = await apiClient.delete(`/api/business-expenses/${id}`);
  return response.data;
}

export async function getRecurringBusinessExpenses(params = {}) {
  const response = await apiClient.get("/api/business-expenses/recurring", {
    params
  });
  return response.data;
}

export async function createRecurringBusinessExpense(payload) {
  const response = await apiClient.post("/api/business-expenses/recurring/create", payload);
  return response.data;
}

export async function updateRecurringBusinessExpense(id, payload) {
  const response = await apiClient.patch(`/api/business-expenses/recurring/${id}`, payload);
  return response.data;
}

export async function deleteRecurringBusinessExpense(id) {
  const response = await apiClient.delete(`/api/business-expenses/recurring/${id}`);
  return response.data;
}
