import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getAgentCollectionQueue,
  getAgentCollectionHistory,
  getAgentCollectionPerformance,
  getAgentCollectionTrend,
  getAgentProfile,
  getAgentRemittanceReview,
  getAgentRemittanceLedger,
  getAgentSalesHistory,
  getAgentSalesPerformance,
  getAgentSalesTrend
} from "../api/agent-performance.api";

export function useAgentSalesPerformance(params = {}) {
  return useQuery({
    queryKey: ["agent-performance", "sales", params],
    queryFn: () => getAgentSalesPerformance(params),
    placeholderData: keepPreviousData
  });
}

export function useAgentSalesTrend(params = {}) {
  return useQuery({
    queryKey: ["agent-performance", "sales-trend", params],
    queryFn: () => getAgentSalesTrend(params),
    placeholderData: keepPreviousData
  });
}

export function useAgentCollectionPerformance(params = {}) {
  return useQuery({
    queryKey: ["agent-performance", "collections", params],
    queryFn: () => getAgentCollectionPerformance(params),
    placeholderData: keepPreviousData
  });
}

export function useAgentCollectionTrend(params = {}) {
  return useQuery({
    queryKey: ["agent-performance", "collections-trend", params],
    queryFn: () => getAgentCollectionTrend(params),
    placeholderData: keepPreviousData
  });
}

export function useAgentCollectionQueue(params = {}) {
  return useQuery({
    queryKey: ["agent-performance", "collection-queue", params],
    queryFn: () => getAgentCollectionQueue(params),
    placeholderData: keepPreviousData
  });
}

export function useAgentRemittanceReview(params = {}) {
  return useQuery({
    queryKey: ["agent-performance", "remittance-review", params],
    queryFn: () => getAgentRemittanceReview(params),
    placeholderData: keepPreviousData
  });
}

export function useAgentProfile(agentId) {
  return useQuery({
    queryKey: ["agent-performance", "profile", agentId],
    enabled: Boolean(agentId),
    queryFn: () => getAgentProfile(agentId)
  });
}

export function useAgentSalesHistory(agentId, params = {}) {
  return useQuery({
    queryKey: ["agent-performance", "sales-history", agentId, params],
    enabled: Boolean(agentId),
    queryFn: () => getAgentSalesHistory(agentId, params),
    placeholderData: keepPreviousData
  });
}

export function useAgentCollectionHistory(agentId, params = {}) {
  return useQuery({
    queryKey: ["agent-performance", "collection-history", agentId, params],
    enabled: Boolean(agentId),
    queryFn: () => getAgentCollectionHistory(agentId, params),
    placeholderData: keepPreviousData
  });
}

export function useAgentRemittanceLedger(agentId, params = {}) {
  return useQuery({
    queryKey: ["agent-performance", "remittance-ledger", agentId, params],
    enabled: Boolean(agentId),
    queryFn: () => getAgentRemittanceLedger(agentId, params),
    placeholderData: keepPreviousData
  });
}
