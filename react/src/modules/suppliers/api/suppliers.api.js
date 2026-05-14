import { apiClient } from "@/shared/api/client";

export async function getSuppliers(params = {}) {
  const response = await apiClient.get("/api/suppliers", { params });
  return response.data;
}

export async function getSupplier(id) {
  const response = await apiClient.get(`/api/suppliers/${id}`);
  return response.data;
}

export async function getSupplierDetails(id) {
  const response = await apiClient.get(`/api/suppliers/${id}/details`);
  return response.data;
}

export async function createSupplier(payload) {
  const response = await apiClient.post("/api/suppliers", payload);
  return response.data;
}

export async function updateSupplier(id, payload) {
  const response = await apiClient.put(`/api/suppliers/${id}`, payload);
  return response.data;
}

export async function updateSupplierStatus(id, status) {
  const response = await apiClient.patch(`/api/suppliers/${id}/status`, { status });
  return response.data;
}

export async function deleteSupplier(id) {
  const response = await apiClient.delete(`/api/suppliers/${id}`);
  return response.data;
}
