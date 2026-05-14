import { apiClient } from "@/shared/api/client";

export async function getSalesSummaryReport(params = {}) {
  const response = await apiClient.get("/api/reports/sales-summary", {
    params
  });

  return response.data;
}

export async function getPurchaseSummaryReport(params = {}) {
  const response = await apiClient.get("/api/reports/purchase-summary", {
    params
  });

  return response.data;
}

export async function getProfitLossReport(params = {}) {
  const response = await apiClient.get("/api/reports/profit-loss", {
    params
  });

  return response.data;
}

export async function getInventoryVelocityReport(params = {}) {
  const response = await apiClient.get("/api/reports/inventory-velocity", {
    params
  });

  return response.data;
}
