import { apiClient } from "@/shared/api/client";

export async function getPayslips(params = {}) {
  const response = await apiClient.get("/api/payslips", { params });
  return response.data;
}

export async function createPayslip(payload) {
  const response = await apiClient.post("/api/payslips/create", payload);
  return response.data;
}

export async function updatePayslip(payslipId, payload) {
  const response = await apiClient.patch(`/api/payslips/${payslipId}`, payload);
  return response.data;
}

export async function getPayslipPdf(payslipId) {
  const response = await apiClient.get(`/api/payslips/${payslipId}/pdf`, {
    responseType: "blob"
  });
  return response.data;
}

export async function deletePayslip(payslipId) {
  const response = await apiClient.delete(`/api/payslips/${payslipId}`);
  return response.data;
}

