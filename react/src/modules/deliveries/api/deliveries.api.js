import { apiClient } from "@/shared/api/client";

export async function getDeliveries(params = {}) {
  const response = await apiClient.get("/api/deliveries", { params });
  return response.data;
}

export async function getDeliveryById(id) {
  const response = await apiClient.get(`/api/deliveries/${id}`);
  return response.data;
}

export async function getDeliverySelectionOptions() {
  const response = await apiClient.get("/api/deliveries/selection-options");
  return response.data;
}

export async function createDelivery(payload) {
  const response = await apiClient.post("/api/deliveries/create", payload);
  return response.data;
}

export async function updateDelivery(id, payload) {
  const response = await apiClient.patch(`/api/deliveries/${id}`, payload);
  return response.data;
}

export async function updateDeliveryStatus(id, statusOrPayload) {
  const payload = typeof statusOrPayload === "string"
    ? { status: statusOrPayload }
    : statusOrPayload;
  const response = await apiClient.patch(`/api/deliveries/${id}/status`, payload);
  return response.data;
}

export async function getDeliveryReceiptPdf(id) {
  const response = await apiClient.get(`/api/deliveries/${id}/receipt/pdf`, {
    responseType: "blob"
  });
  return response.data;
}
