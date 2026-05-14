import { apiClient } from "@/shared/api/client";

export async function getCustomers(params = {}) {
  const response = await apiClient.get("/api/customers", {
    params
  });

  return response.data;
}

export async function createCustomer(payload) {
  const response = await apiClient.post("/api/customers/create", payload);
  return response.data;
}

export async function updateCustomer(customerId, payload) {
  const response = await apiClient.patch(`/api/customers/${customerId}`, payload);
  return response.data;
}

export async function deleteCustomer(customerId) {
  const response = await apiClient.delete(`/api/customers/${customerId}`);
  return response.data;
}

export async function getCustomerDetails(customerId) {
  const response = await apiClient.get(`/api/customers/${customerId}/details`);
  return response.data;
}

export async function getCustomerOrders(customerId, params = {}) {
  const response = await apiClient.get(`/api/customers/${customerId}/orders`, {
    params
  });
  return response.data;
}

export async function getCustomerUnpaidOrders(customerId) {
  const response = await apiClient.get(`/api/customers/${customerId}/unpaid-orders`);
  return response.data;
}

export async function getCustomerPayments(customerId, params = {}) {
  const response = await apiClient.get(`/api/customers/${customerId}/payments`, {
    params
  });
  return response.data;
}

export async function getCustomerReturns(customerId, params = {}) {
  const response = await apiClient.get(`/api/customers/${customerId}/returns`, {
    params
  });
  return response.data;
}

export async function getCustomerPerformanceInsight(customerId) {
  const response = await apiClient.get(`/api/customers/${customerId}/performance-insight`);
  return response.data;
}

export async function getCustomerStatementPdf(customerId, params = {}) {
  const response = await apiClient.get(`/api/customers/${customerId}/statement`, {
    params,
    responseType: "blob"
  });

  return response;
}

export async function recordCustomerPayment(formData) {
  const response = await apiClient.post("/api/payments/customer-payments/create", formData);
  return response.data;
}

export async function scanCustomerPaymentReceipt(formData) {
  const response = await apiClient.post("/api/payments/scan-receipt", formData);
  return response.data;
}
