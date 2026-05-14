import { apiClient } from "@/shared/api/client";

export async function getAccountsPayable(params = {}) {
  const response = await apiClient.get("/api/accounts-payable", { params });
  return response.data;
}

export async function getAccountsPayableById(id) {
  const response = await apiClient.get(`/api/accounts-payable/${id}`);
  return response.data;
}

export async function updateAccountsPayable(id, payload) {
  const response = await apiClient.patch(`/api/accounts-payable/${id}`, payload);
  return response.data;
}

export async function recordSupplierPayment(formData) {
  const response = await apiClient.post("/api/payments/supplier-payments/create", formData);
  return response.data;
}
