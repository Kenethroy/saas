import { apiClient } from "@/shared/api/client";

export async function getAgentSalesPerformance(params = {}) {
  const response = await apiClient.get("/api/agent-performance/sales", {
    params
  });

  return response.data;
}

export async function getAgentSalesTrend(params = {}) {
  const response = await apiClient.get("/api/agent-performance/sales/trend", {
    params
  });

  return response.data;
}

export async function getAgentCollectionPerformance(params = {}) {
  const response = await apiClient.get("/api/agent-performance/collections", {
    params
  });

  return response.data;
}

export async function getAgentCollectionTrend(params = {}) {
  const response = await apiClient.get("/api/agent-performance/collections/trend", {
    params
  });

  return response.data;
}

export async function getAgentCollectionQueue(params = {}) {
  const response = await apiClient.get("/api/agent-performance/collection-queue", {
    params
  });

  return response.data;
}

export async function getAgentRemittanceReview(params = {}) {
  const response = await apiClient.get("/api/agent-performance/remittance-review", {
    params
  });

  return response.data;
}

export async function getAgentProfile(agentId) {
  const response = await apiClient.get(`/api/agent-performance/agents/${agentId}/profile`);
  return response.data;
}

export async function getAgentSalesHistory(agentId, params = {}) {
  const response = await apiClient.get(`/api/agent-performance/agents/${agentId}/sales-history`, {
    params
  });
  return response.data;
}

export async function getAgentCollectionHistory(agentId, params = {}) {
  const response = await apiClient.get(`/api/agent-performance/agents/${agentId}/collection-history`, {
    params
  });
  return response.data;
}

export async function getAgentRemittanceLedger(agentId, params = {}) {
  const response = await apiClient.get(`/api/agent-performance/agents/${agentId}/remittance-ledger`, {
    params
  });
  return response.data;
}
