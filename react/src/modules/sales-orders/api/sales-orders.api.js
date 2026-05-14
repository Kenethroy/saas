import { apiClient } from "@/shared/api/client";

export async function getSalesOrders(params = {}) {
  const response = await apiClient.get("/api/sales-orders", {
    params
  });

  return response.data;
}

export async function getSalesOrderById(id) {
  const response = await apiClient.get(`/api/sales-orders/${id}`);
  return response.data;
}

export async function updateSalesOrder(id, payload) {
  const response = await apiClient.patch(`/api/sales-orders/${id}`, payload);
  return response.data;
}

export async function updateSalesOrderStatus(id, status) {
  const response = await apiClient.patch(`/api/sales-orders/${id}/status`, {
    status
  });
  return response.data;
}

export async function createSalesOrder(payload) {
  const response = await apiClient.post("/api/sales-orders/create", payload);
  return response.data;
}

export async function getSalesOrderInvoicePdf(id) {
  const response = await apiClient.get(`/api/sales-orders/${id}/invoice/pdf`, {
    responseType: "blob"
  });
  return response.data;
}
