import { apiClient } from "@/shared/api/client";

export async function getCustomerReturns(params = {}) {
  const response = await apiClient.get("/api/customer-returns", {
    params
  });

  return response.data;
}

export async function getCustomerReturn(id) {
  const response = await apiClient.get(`/api/customer-returns/${id}`);
  return response.data;
}

export async function createCustomerReturn(payload) {
  const response = await apiClient.post("/api/customer-returns", payload);
  return response.data;
}

export async function updateCustomerReturn(id, payload) {
  const response = await apiClient.put(`/api/customer-returns/${id}`, payload);
  return response.data;
}

export async function deleteCustomerReturn(id) {
  const response = await apiClient.delete(`/api/customer-returns/${id}`);
  return response.data;
}

export async function getCustomerInvoices(customerId) {
  const response = await apiClient.get(`/api/customer-returns/invoices/${customerId}`);
  return response.data;
}
