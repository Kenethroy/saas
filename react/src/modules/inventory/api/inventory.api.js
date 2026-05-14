import { apiClient } from "@/shared/api/client";

export async function getInventoryOverview(params = {}) {
  const response = await apiClient.get("/api/products/inventory-overview", {
    params
  });

  return response.data;
}

export async function applyStockAdjustment(payload) {
  const response = await apiClient.post("/api/inventory/stock-adjustments/apply", payload);
  return response.data;
}

export async function getInventoryTransactions(params = {}) {
  const response = await apiClient.get("/api/inventory/transactions", {
    params
  });

  return response.data;
}

export async function getStockAdjustments(params = {}) {
  const response = await apiClient.get("/api/stock-adjustments", {
    params
  });

  return response.data;
}

export async function getStockAdjustmentById(id) {
  const response = await apiClient.get(`/api/stock-adjustments/${id}`);
  return response.data;
}

export async function createStockAdjustment(payload) {
  const response = await apiClient.post("/api/stock-adjustments/create", payload);
  return response.data;
}

export async function updateStockAdjustment(id, payload) {
  const response = await apiClient.patch(`/api/stock-adjustments/${id}`, payload);
  return response.data;
}

export async function submitStockAdjustment(id) {
  const response = await apiClient.patch(`/api/stock-adjustments/${id}/submit`);
  return response.data;
}

export async function approveStockAdjustment(id) {
  const response = await apiClient.patch(`/api/stock-adjustments/${id}/approve`);
  return response.data;
}

export async function rejectStockAdjustment(id, reason) {
  const response = await apiClient.patch(`/api/stock-adjustments/${id}/reject`, {
    reason
  });
  return response.data;
}

export async function deleteStockAdjustment(id) {
  const response = await apiClient.delete(`/api/stock-adjustments/${id}`);
  return response.data;
}
