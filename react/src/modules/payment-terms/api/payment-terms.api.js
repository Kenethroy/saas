import { apiClient } from "@/shared/api/client";

export async function getPaymentTerms(params = {}) {
  const response = await apiClient.get("/api/payment-terms", {
    params
  });

  return response.data;
}

export async function createPaymentTerm(payload) {
  const response = await apiClient.post("/api/payment-terms/create", payload);
  return response.data;
}

export async function updatePaymentTerm(id, payload) {
  const response = await apiClient.patch(`/api/payment-terms/${id}`, payload);
  return response.data;
}

export async function deletePaymentTerm(id) {
  const response = await apiClient.delete(`/api/payment-terms/${id}`);
  return response.data;
}
