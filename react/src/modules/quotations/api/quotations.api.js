import { apiClient } from "@/shared/api/client";

export async function getQuotations(params = {}) {
  const response = await apiClient.get("/api/quotations", {
    params
  });

  return response.data;
}

export async function getQuotationById(id) {
  const response = await apiClient.get(`/api/quotations/${id}`);
  return response.data;
}

export async function createQuotation(payload) {
  const response = await apiClient.post("/api/quotations/create", payload);
  return response.data;
}

export async function updateQuotation(id, payload) {
  const response = await apiClient.patch(`/api/quotations/${id}`, payload);
  return response.data;
}

export async function deleteQuotation(id) {
  const response = await apiClient.delete(`/api/quotations/${id}`);
  return response.data;
}

export async function updateQuotationStatus(id, status) {
  const response = await apiClient.patch(`/api/quotations/${id}/status`, {
    status
  });
  return response.data;
}

export async function sendQuotation(id) {
  const response = await apiClient.post(`/api/quotations/${id}/send`);
  return response.data;
}

export async function convertQuotation(id) {
  const response = await apiClient.post(`/api/quotations/${id}/convert`);
  return response.data;
}

export async function getQuotationPdf(id) {
  const response = await apiClient.get(`/api/quotations/${id}/pdf`, {
    responseType: "blob"
  });
  return response.data;
}
