import { apiClient } from "@/shared/api/client";

export async function getPurchaseOrders(params = {}) {
  const response = await apiClient.get("/api/purchase-orders", {
    params
  });

  return response.data;
}

export async function getPurchaseOrderById(id) {
  const response = await apiClient.get(`/api/purchase-orders/${id}`);
  return response.data;
}

export async function getPurchaseOrderPdf(id) {
  const response = await apiClient.get(`/api/purchase-orders/${id}/pdf`, {
    responseType: "blob"
  });
  return response.data;
}

export async function updatePurchaseOrder(id, payload) {
  const response = await apiClient.put(`/api/purchase-orders/${id}`, payload);
  return response.data;
}

export async function updatePurchaseOrderStatus(id, status) {
  const response = await apiClient.patch(`/api/purchase-orders/${id}/status`, {
    status
  });
  return response.data;
}

export async function receivePurchaseOrder(id, grnPayload) {
  const response = await apiClient.post(`/api/purchase-orders/${id}/receive`, grnPayload);
  return response.data;
}

export async function createPurchaseOrder(payload) {
  const response = await apiClient.post("/api/purchase-orders", payload);
  return response.data;
}

export async function deletePurchaseOrder(id) {
  const response = await apiClient.delete(`/api/purchase-orders/${id}`);
  return response.data;
}
