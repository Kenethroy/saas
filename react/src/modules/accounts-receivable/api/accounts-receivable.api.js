import { apiClient } from "@/shared/api/client";

export async function getAccountsReceivables(params = {}) {
  const response = await apiClient.get("/api/accounts-receivable/list", { params });
  return response.data;
}

export async function getAccountsReceivable(id) {
  const response = await apiClient.get(`/api/accounts-receivable/${id}`);
  return response.data;
}

export async function updateAccountsReceivable(id, payload) {
  const response = await apiClient.put(`/api/accounts-receivable/update/${id}`, payload);
  return response.data;
}
