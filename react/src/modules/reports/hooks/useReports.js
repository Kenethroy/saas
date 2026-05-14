import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  getInventoryVelocityReport,
  getProfitLossReport,
  getPurchaseSummaryReport,
  getSalesSummaryReport
} from "../api/reports.api";

export function useSalesSummaryReport(params = {}) {
  return useQuery({
    queryKey: ["report", "sales-summary", params],
    queryFn: () => getSalesSummaryReport(params),
    placeholderData: keepPreviousData
  });
}

export function usePurchaseSummaryReport(params = {}) {
  return useQuery({
    queryKey: ["report", "purchase-summary", params],
    queryFn: () => getPurchaseSummaryReport(params),
    placeholderData: keepPreviousData
  });
}

export function useProfitLossReport(params = {}) {
  return useQuery({
    queryKey: ["report", "profit-loss", params],
    queryFn: () => getProfitLossReport(params),
    placeholderData: keepPreviousData
  });
}

export function useInventoryVelocityReport(params = {}) {
  return useQuery({
    queryKey: ["report", "inventory-velocity", params],
    queryFn: () => getInventoryVelocityReport(params),
    placeholderData: keepPreviousData
  });
}
