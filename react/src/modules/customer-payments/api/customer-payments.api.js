import { apiClient } from "@/shared/api/client";

export async function getCustomerPayments(params = {}) {
  const response = await apiClient.get("/api/payments", {
    params
  });

  return response.data;
}

export async function recordCustomerPayment(formData) {
  const response = await apiClient.post("/api/payments/customer-payments/create", formData);
  return response.data;
}

export async function scanCustomerPaymentReceipt(formData) {
  const response = await apiClient.post("/api/payments/scan-receipt", formData);
  return response.data;
}
